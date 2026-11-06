import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { ClockService } from 'src/common/clock/clock.service';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../entities/purchase-order-item.entity';
import { StockMovementType } from '../entities/stock-movement.entity';
import { InventoryItem } from '../entities/inventory-item.entity';
import { Supplier } from '../entities/supplier.entity';
import { assertAllInOrg, assertInOrg } from 'src/common/tenancy/assert-in-org';
import {
  CreatePurchaseOrderDto,
  PurchaseOrderFilterDto,
  BulkReceiveDto,
} from '../dto/purchase-order.dto';
import { InventoryService } from './inventory.service';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const VALID_PO_TRANSITIONS: Record<
  PurchaseOrderStatus,
  PurchaseOrderStatus[]
> = {
  [PurchaseOrderStatus.DRAFT]: [
    PurchaseOrderStatus.ORDERED,
    PurchaseOrderStatus.CANCELLED,
  ],
  [PurchaseOrderStatus.ORDERED]: [
    PurchaseOrderStatus.PARTIALLY_RECEIVED,
    PurchaseOrderStatus.RECEIVED,
    PurchaseOrderStatus.CANCELLED,
  ],
  [PurchaseOrderStatus.PARTIALLY_RECEIVED]: [
    PurchaseOrderStatus.RECEIVED,
    PurchaseOrderStatus.CANCELLED,
  ],
  [PurchaseOrderStatus.RECEIVED]: [],
  [PurchaseOrderStatus.CANCELLED]: [],
};

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly poItemRepo: Repository<PurchaseOrderItem>,
    private readonly dataSource: DataSource,
    private readonly inventoryService: InventoryService,
    private readonly clock: ClockService,
  ) {}

  /**
   * The location's calendar day as a Date for the `date` columns
   * (`orderDate`, `receivedDate`) — UTC midnight of the clinic's today.
   */
  private async clinicToday(locationId: string): Promise<Date> {
    const tz = await this.clock.timezoneFor(locationId);
    return new Date(`${this.clock.today(tz)}T00:00:00Z`);
  }

  private async generatePoNumber(
    organizationId: string,
    locationId: string,
  ): Promise<string> {
    const last = await this.poRepo.findOne({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    const year = (await this.clinicToday(locationId)).getUTCFullYear();
    let seq = 1;
    if (last?.poNumber) {
      const parts = last.poNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(lastSeq)) seq = lastSeq + 1;
    }
    return `PO-${year}-${String(seq).padStart(5, '0')}`;
  }

  async create(
    organizationId: string,
    locationId: string,
    dto: CreatePurchaseOrderDto,
    createdBy: string,
  ): Promise<PurchaseOrder> {
    // Supplier and items from the body must be this clinic's (this location's
    // stock) — the PO detail loads them back.
    await assertInOrg(this.dataSource.manager, [
      { entity: Supplier, id: dto.supplierId, where: { organizationId }, label: 'Supplier' },
    ]);
    await assertAllInOrg(
      this.dataSource.manager,
      InventoryItem,
      dto.items.map((l) => l.inventoryItemId),
      { organizationId, locationId },
      'Inventory item',
    );

    const poNumber = await this.generatePoNumber(
      organizationId,
      locationId,
    );

    const items = dto.items.map((line, index) =>
      this.poItemRepo.create({
        inventoryItemId: line.inventoryItemId,
        orderedQuantity: line.orderedQuantity,
        receivedQuantity: 0,
        unitPrice: line.unitPrice,
        totalPrice: round2(num(line.orderedQuantity) * num(line.unitPrice)),
        notes: line.notes ?? null,
        sortOrder: index,
      }),
    );

    const subtotal = round2(
      items.reduce((sum, i) => sum + num(i.totalPrice), 0),
    );
    const taxRate = num(dto.taxRate);
    const taxAmount = round2(subtotal * (taxRate / 100));
    const totalAmount = round2(subtotal + taxAmount);

    const po = this.poRepo.create({
      poNumber,
      organizationId,
      locationId,
      supplierId: dto.supplierId,
      createdBy,
      status: PurchaseOrderStatus.DRAFT,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      expectedDeliveryDate: dto.expectedDeliveryDate
        ? new Date(dto.expectedDeliveryDate)
        : null,
      notes: dto.notes ?? null,
      items,
    });

    const saved = await this.poRepo.save(po);
    return this.findOne(saved.id, organizationId);
  }

  async findAll(
    organizationId: string,
    locationId: string,
    filters: PurchaseOrderFilterDto,
  ): Promise<PaginatedResponseDto<PurchaseOrder>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const qb = this.poRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .loadRelationCountAndMap('po.itemsCount', 'po.items')
      .where('po.organizationId = :organizationId', { organizationId })
      .andWhere('po.locationId = :locationId', { locationId });

    if (filters.status)
      qb.andWhere('po.status = :status', { status: filters.status });
    if (filters.supplierId)
      qb.andWhere('po.supplierId = :supplierId', {
        supplierId: filters.supplierId,
      });

    qb.orderBy('po.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginatedResponseDto.create(data, total, page, limit);
  }

  async findOne(id: string, organizationId: string): Promise<PurchaseOrder> {
    const po = await this.poRepo.findOne({
      where: { id, organizationId },
      relations: ['items', 'items.inventoryItem', 'supplier', 'creator'],
      order: { items: { sortOrder: 'ASC' } },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async updateStatus(
    id: string,
    organizationId: string,
    newStatus: PurchaseOrderStatus,
  ): Promise<PurchaseOrder> {
    const po = await this.findOne(id, organizationId);
    const allowed = VALID_PO_TRANSITIONS[po.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition purchase order from ${po.status} to ${newStatus}`,
      );
    }
    po.status = newStatus;
    if (newStatus === PurchaseOrderStatus.ORDERED)
      po.orderDate = await this.clinicToday(po.locationId);
    if (newStatus === PurchaseOrderStatus.RECEIVED)
      po.receivedDate = await this.clinicToday(po.locationId);
    await this.poRepo.save(po);
    return this.findOne(id, organizationId);
  }

  async receiveItems(
    poId: string,
    organizationId: string,
    locationId: string,
    dto: BulkReceiveDto,
    receivedBy: string,
  ): Promise<PurchaseOrder> {
    const po = await this.findOne(poId, organizationId);
    if (
      po.status !== PurchaseOrderStatus.ORDERED &&
      po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED
    ) {
      throw new BadRequestException(
        `Cannot receive items for a purchase order in ${po.status} status`,
      );
    }

    const receivedOn = await this.clinicToday(po.locationId);
    await this.dataSource.transaction(async (manager) => {
      const poItemRepo = manager.getRepository(PurchaseOrderItem);
      const poRepo = manager.getRepository(PurchaseOrder);
      const itemRepo = manager.getRepository(InventoryItem);

      for (const line of dto.items) {
        if (line.receivedQuantity <= 0) continue;

        const poItem = po.items.find((i) => i.id === line.poItemId);
        if (!poItem) {
          throw new NotFoundException(
            `Purchase order item ${line.poItemId} not found`,
          );
        }

        const alreadyReceived = num(poItem.receivedQuantity);
        const ordered = num(poItem.orderedQuantity);
        if (alreadyReceived + line.receivedQuantity > ordered) {
          throw new BadRequestException(
            `Cannot receive more than ordered for "${poItem.inventoryItem?.name ?? poItem.inventoryItemId}". Ordered: ${ordered}, already received: ${alreadyReceived}`,
          );
        }

        // Update PO item received qty + batch info
        poItem.receivedQuantity = alreadyReceived + line.receivedQuantity;
        if (line.batchNumber) poItem.batchNumber = line.batchNumber;
        if (line.expiryDate) poItem.expiryDate = new Date(line.expiryDate);
        await poItemRepo.save(poItem);

        // Add stock via the inventory service (same transaction)
        await this.inventoryService.applyMovement(
          manager,
          poItem.inventoryItemId,
          organizationId,
          locationId,
          {
            quantity: line.receivedQuantity,
            movementType: StockMovementType.PURCHASE_IN,
            referenceType: 'purchase_order',
            referenceId: poId,
            batchNumber: line.batchNumber ?? null,
            expiryDate: line.expiryDate ?? null,
          },
          receivedBy,
        );

        // Update the inventory item's latest purchase price
        await itemRepo.update(
          { id: poItem.inventoryItemId },
          { unitPrice: num(poItem.unitPrice) },
        );
      }

      // Recompute PO status from item received quantities
      const fullyReceived = po.items.every(
        (i) => num(i.receivedQuantity) >= num(i.orderedQuantity),
      );
      const anyReceived = po.items.some((i) => num(i.receivedQuantity) > 0);

      if (fullyReceived) {
        po.status = PurchaseOrderStatus.RECEIVED;
        po.receivedDate = receivedOn;
      } else if (anyReceived) {
        po.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
      }
      await poRepo.save(po);
    });

    return this.findOne(poId, organizationId);
  }

  async cancel(id: string, organizationId: string): Promise<PurchaseOrder> {
    const po = await this.findOne(id, organizationId);
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft purchase orders can be cancelled',
      );
    }
    po.status = PurchaseOrderStatus.CANCELLED;
    await this.poRepo.save(po);
    return this.findOne(id, organizationId);
  }
}
