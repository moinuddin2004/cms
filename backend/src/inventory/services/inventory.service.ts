import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { InventoryItem } from '../entities/inventory-item.entity';
import { assertInOrg } from 'src/common/tenancy/assert-in-org';
import { InventoryCategory } from '../entities/inventory-category.entity';
import {
  StockMovement,
  StockMovementType,
} from '../entities/stock-movement.entity';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventoryItemFilterDto,
  AdjustStockDto,
} from '../dto/inventory-item.dto';
import { RecordConsumptionDto } from '../dto/patient-consumption.dto';
import { ClockService } from 'src/common/clock/clock.service';
import { addDays } from 'src/common/clock/tz.util';

/** TypeORM returns decimals as strings; coerce safely. */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const OUT_TYPES = new Set<StockMovementType>([
  StockMovementType.CONSUMPTION,
  StockMovementType.WASTAGE,
  StockMovementType.TRANSFER_OUT,
  StockMovementType.RETURN_TO_SUPPLIER,
]);

/** Internal movement payload — supports all movement types, not just manual ones. */
export interface StockMovementInput {
  quantity: number;
  movementType: StockMovementType;
  referenceType?: string | null;
  referenceId?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(StockMovement)
    private readonly movementRepo: Repository<StockMovement>,
    private readonly dataSource: DataSource,
    private readonly clock: ClockService,
  ) {}

  /**
   * Last expiry date (inclusive, 'YYYY-MM-DD') that counts as "expiring":
   * the LOCATION's today + `days`. Compared against the `date` column.
   */
  private async expiryCutoff(locationId: string, days: number) {
    const tz = await this.clock.timezoneFor(locationId);
    return addDays(this.clock.today(tz), days);
  }

  // ── SKU uniqueness ──────────────────────────────────────────────────
  private async assertSkuUnique(
    organizationId: string,
    sku: string,
    excludeItemId?: string,
  ): Promise<void> {
    const existing = await this.itemRepo.findOne({
      where: { organizationId, sku },
    });
    if (existing && existing.id !== excludeItemId) {
      throw new ConflictException(`An item with SKU "${sku}" already exists`);
    }
  }

  // ── Create ──────────────────────────────────────────────────────────
  async create(
    organizationId: string,
    locationId: string,
    dto: CreateInventoryItemDto,
    createdBy: string,
  ): Promise<InventoryItem> {
    if (dto.sku) await this.assertSkuUnique(organizationId, dto.sku);
    await assertInOrg(this.dataSource.manager, [
      { entity: InventoryCategory, id: dto.categoryId, where: { organizationId }, label: 'Category' },
    ]);

    const { initialStock, expiryDate, ...rest } = dto;

    const item = this.itemRepo.create({
      ...rest,
      organizationId,
      locationId,
      currentStock: 0,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
    });
    const saved = await this.itemRepo.save(item);

    if (initialStock && initialStock > 0) {
      await this.adjustStock(
        saved.id,
        organizationId,
        locationId,
        {
          quantity: initialStock,
          movementType: StockMovementType.INITIAL_STOCK,
          expiryDate,
          notes: 'Initial stock on item creation',
        } as AdjustStockDto,
        createdBy,
      );
    }

    return this.findOneBasic(saved.id, organizationId, locationId);
  }

  private async findOneBasic(
    id: string,
    organizationId: string,
    locationId: string,
  ): Promise<InventoryItem> {
    const item = await this.itemRepo.findOne({
      where: { id, organizationId, locationId },
      relations: ['category'],
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  // ── List with filters ───────────────────────────────────────────────
  async findAll(
    organizationId: string,
    locationId: string,
    filters: InventoryItemFilterDto,
  ): Promise<PaginatedResponseDto<InventoryItem>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const qb = this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.category', 'category')
      .where('item.organizationId = :organizationId', { organizationId })
      .andWhere('item.locationId = :locationId', { locationId })
      .andWhere('item.isActive = :isActive', { isActive: true });

    if (filters.categoryId)
      qb.andWhere('item.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });

    if (filters.search)
      qb.andWhere('(item.name ILIKE :search OR item.sku ILIKE :search)', {
        search: `%${filters.search}%`,
      });

    if (filters.lowStockOnly)
      qb.andWhere(
        'item.currentStock > 0 AND item.currentStock <= item.reorderLevel',
      );

    if (filters.outOfStockOnly)
      qb.andWhere('item.currentStock = 0');

    if (filters.expiringOnly) {
      const cutoff = await this.expiryCutoff(locationId, 30);
      qb.andWhere(
        'item.expiryDate IS NOT NULL AND item.expiryDate <= :cutoff',
        { cutoff },
      );
    }

    qb.orderBy('item.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginatedResponseDto.create(data, total, page, limit);
  }

  // ── Detail with recent movements ────────────────────────────────────
  async findOne(
    id: string,
    organizationId: string,
    locationId: string,
  ): Promise<InventoryItem & { recentMovements: StockMovement[] }> {
    const item = await this.findOneBasic(id, organizationId, locationId);
    const recentMovements = await this.movementRepo.find({
      where: { inventoryItemId: id },
      relations: ['performer'],
      order: { createdAt: 'DESC' },
      take: 10,
    });
    return Object.assign(item, { recentMovements });
  }

  // ── Update ──────────────────────────────────────────────────────────
  async update(
    id: string,
    organizationId: string,
    locationId: string,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItem> {
    const item = await this.findOneBasic(id, organizationId, locationId);

    // Never allow direct stock mutation through update.
    delete (dto as Record<string, unknown>).currentStock;

    if (dto.sku && dto.sku !== item.sku)
      await this.assertSkuUnique(organizationId, dto.sku, id);
    await assertInOrg(this.dataSource.manager, [
      { entity: InventoryCategory, id: dto.categoryId, where: { organizationId }, label: 'Category' },
    ]);

    const { expiryDate, ...rest } = dto;
    Object.assign(item, rest);
    if (expiryDate !== undefined)
      item.expiryDate = expiryDate ? new Date(expiryDate) : null;

    return this.itemRepo.save(item);
  }

  // ── Stock adjustment (the critical method) ──────────────────────────
  async adjustStock(
    itemId: string,
    organizationId: string,
    locationId: string,
    dto: AdjustStockDto,
    performedBy: string,
  ): Promise<StockMovement> {
    // Notes required for WASTAGE and MANUAL_ADJUSTMENT
    if (
      (dto.movementType === StockMovementType.WASTAGE ||
        dto.movementType === StockMovementType.MANUAL_ADJUSTMENT) &&
      !dto.notes?.trim()
    ) {
      throw new BadRequestException(
        'Notes are required for wastage and manual adjustments',
      );
    }

    return this.dataSource.transaction((manager) =>
      this.applyMovement(
        manager,
        itemId,
        organizationId,
        locationId,
        dto,
        performedBy,
      ),
    );
  }

  /**
   * Applies a single stock movement within the given transaction manager.
   * Reusable by purchase-order receiving and patient consumption flows.
   */
  async applyMovement(
    manager: EntityManager,
    itemId: string,
    organizationId: string,
    locationId: string,
    input: StockMovementInput,
    performedBy: string,
  ): Promise<StockMovement> {
    const itemRepo = manager.getRepository(InventoryItem);
    const movementRepo = manager.getRepository(StockMovement);

    const item = await itemRepo.findOne({
      where: { id: itemId, organizationId, locationId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    // Determine signed delta
    let delta = Math.abs(num(input.quantity));
    if (input.movementType === StockMovementType.MANUAL_ADJUSTMENT) {
      delta = num(input.quantity); // may be negative
    } else if (OUT_TYPES.has(input.movementType)) {
      delta = -delta;
    }

    const previousStock = num(item.currentStock);
    const newStock = previousStock + delta;
    if (newStock < 0) {
      throw new BadRequestException(
        `Insufficient stock for "${item.name}". Available: ${previousStock} ${item.unit}`,
      );
    }

    const movement = movementRepo.create({
      inventoryItemId: item.id,
      organizationId,
      locationId,
      movementType: input.movementType,
      quantity: delta,
      previousStock,
      newStock,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      batchNumber: input.batchNumber ?? null,
      expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
      notes: input.notes ?? null,
      performedBy,
    });
    const savedMovement = await movementRepo.save(movement);

    item.currentStock = newStock;
    // Keep nearest expiry across incoming batches
    if (input.expiryDate) {
      const incoming = new Date(input.expiryDate);
      if (!item.expiryDate || incoming < new Date(item.expiryDate)) {
        item.expiryDate = incoming;
      }
    }
    await itemRepo.save(item);

    return savedMovement;
  }

  // ── Consume items (called from patient-consumption flow) ────────────
  async consumeItems(
    organizationId: string,
    locationId: string,
    dto: RecordConsumptionDto,
    performedBy: string,
  ): Promise<void> {
    const referenceType = dto.appointmentId
      ? 'appointment'
      : dto.treatmentPlanId
        ? 'treatment_plan'
        : 'manual';
    const referenceId =
      dto.appointmentId ?? dto.treatmentPlanId ?? null;

    await this.dataSource.transaction(async (manager) => {
      for (const line of dto.items) {
        await this.applyMovement(
          manager,
          line.inventoryItemId,
          organizationId,
          locationId,
          {
            quantity: line.quantity,
            movementType: StockMovementType.CONSUMPTION,
            referenceType,
            referenceId,
          },
          performedBy,
        );
      }
    });
  }

  // ── Movements history ───────────────────────────────────────────────
  async getStockMovements(
    itemId: string,
    organizationId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<StockMovement>> {
    const qb = this.movementRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.performer', 'performer')
      .where('m.inventoryItemId = :itemId', { itemId })
      .andWhere('m.organizationId = :organizationId', { organizationId })
      .orderBy('m.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginatedResponseDto.create(data, total, page, limit);
  }

  // ── Alert queries ───────────────────────────────────────────────────
  async getLowStockItems(
    organizationId: string,
    locationId: string,
  ): Promise<InventoryItem[]> {
    return this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.category', 'category')
      .where('item.organizationId = :organizationId', { organizationId })
      .andWhere('item.locationId = :locationId', { locationId })
      .andWhere('item.isActive = :isActive', { isActive: true })
      .andWhere('item.currentStock > 0')
      .andWhere('item.currentStock <= item.reorderLevel')
      .orderBy('item.currentStock / NULLIF(item.reorderLevel, 0)', 'ASC')
      .getMany();
  }

  async getExpiringItems(
    organizationId: string,
    locationId: string,
    daysAhead = 30,
  ): Promise<InventoryItem[]> {
    const cutoff = await this.expiryCutoff(locationId, daysAhead);
    return this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.category', 'category')
      .where('item.organizationId = :organizationId', { organizationId })
      .andWhere('item.locationId = :locationId', { locationId })
      .andWhere('item.isActive = :isActive', { isActive: true })
      .andWhere('item.expiryDate IS NOT NULL')
      .andWhere('item.expiryDate <= :cutoff', { cutoff })
      .orderBy('item.expiryDate', 'ASC')
      .getMany();
  }

  async getOutOfStockItems(
    organizationId: string,
    locationId: string,
  ): Promise<InventoryItem[]> {
    return this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.category', 'category')
      .where('item.organizationId = :organizationId', { organizationId })
      .andWhere('item.locationId = :locationId', { locationId })
      .andWhere('item.isActive = :isActive', { isActive: true })
      .andWhere('item.currentStock = 0')
      .orderBy('item.name', 'ASC')
      .getMany();
  }

  // ── Stats ───────────────────────────────────────────────────────────
  async getStats(
    organizationId: string,
    locationId: string,
  ): Promise<{
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    expiringCount: number;
    outOfStockCount: number;
  }> {
    const base = () =>
      this.itemRepo
        .createQueryBuilder('item')
        .where('item.organizationId = :organizationId', { organizationId })
        .andWhere('item.locationId = :locationId', { locationId })
        .andWhere('item.isActive = :isActive', { isActive: true });

    const cutoffStr = await this.expiryCutoff(locationId, 30);

    const totalItems = await base().getCount();

    const valueRow = await base()
      .select('COALESCE(SUM(item.currentStock * item.unitPrice), 0)', 'total')
      .getRawOne<{ total: string }>();

    const lowStockCount = await base()
      .andWhere('item.currentStock > 0')
      .andWhere('item.currentStock <= item.reorderLevel')
      .getCount();

    const expiringCount = await base()
      .andWhere('item.expiryDate IS NOT NULL')
      .andWhere('item.expiryDate <= :cutoff', { cutoff: cutoffStr })
      .getCount();

    const outOfStockCount = await base()
      .andWhere('item.currentStock = 0')
      .getCount();

    return {
      totalItems,
      totalValue: num(valueRow?.total),
      lowStockCount,
      expiringCount,
      outOfStockCount,
    };
  }

  // ── Soft delete ─────────────────────────────────────────────────────
  async deactivate(
    id: string,
    organizationId: string,
    locationId: string,
  ): Promise<{ id: string }> {
    const item = await this.findOneBasic(id, organizationId, locationId);
    item.isActive = false;
    await this.itemRepo.save(item);
    return { id };
  }
}
