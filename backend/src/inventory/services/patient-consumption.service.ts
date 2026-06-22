import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { PatientConsumption } from '../entities/patient-consumption.entity';
import { PatientConsumptionItem } from '../entities/patient-consumption-item.entity';
import { InventoryItem } from '../entities/inventory-item.entity';
import { StockMovementType } from '../entities/stock-movement.entity';
import { RecordConsumptionDto } from '../dto/patient-consumption.dto';
import { InventoryService } from './inventory.service';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class PatientConsumptionService {
  constructor(
    @InjectRepository(PatientConsumption)
    private readonly consumptionRepo: Repository<PatientConsumption>,
    @InjectRepository(PatientConsumptionItem)
    private readonly consumptionItemRepo: Repository<PatientConsumptionItem>,
    private readonly dataSource: DataSource,
    private readonly inventoryService: InventoryService,
  ) {}

  async recordConsumption(
    organizationId: string,
    locationId: string,
    dto: RecordConsumptionDto,
    performedBy: string,
  ): Promise<PatientConsumption> {
    const referenceType = dto.appointmentId
      ? 'appointment'
      : dto.treatmentPlanId
        ? 'treatment_plan'
        : 'manual';

    const consumptionId = await this.dataSource.transaction(
      async (manager) => {
        const consumptionRepo = manager.getRepository(PatientConsumption);
        const itemRepo = manager.getRepository(InventoryItem);

        // Build line items with price snapshots
        const lineItems: PatientConsumptionItem[] = [];
        for (const line of dto.items) {
          const invItem = await itemRepo.findOne({
            where: { id: line.inventoryItemId, organizationId, locationId },
          });
          if (!invItem) {
            throw new NotFoundException(
              `Inventory item ${line.inventoryItemId} not found`,
            );
          }
          const unitPrice = num(invItem.unitPrice);
          const totalPrice = round2(num(line.quantity) * unitPrice);
          lineItems.push(
            this.consumptionItemRepo.create({
              inventoryItemId: line.inventoryItemId,
              quantity: line.quantity,
              unitPrice,
              totalPrice,
              wasFromTemplate: line.wasFromTemplate,
            }),
          );
        }

        const totalCost = round2(
          lineItems.reduce((sum, i) => sum + num(i.totalPrice), 0),
        );

        const consumption = consumptionRepo.create({
          organizationId,
          locationId,
          patientId: dto.patientId,
          appointmentId: dto.appointmentId ?? null,
          treatmentPlanId: dto.treatmentPlanId ?? null,
          templateId: dto.templateId ?? null,
          performedBy,
          totalCost,
          notes: dto.notes ?? null,
          items: lineItems,
        });
        const saved = await consumptionRepo.save(consumption);

        const referenceId =
          dto.appointmentId ?? dto.treatmentPlanId ?? saved.id;

        // Deduct stock for each item (same transaction → rolls back together)
        for (const line of dto.items) {
          await this.inventoryService.applyMovement(
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

        return saved.id;
      },
    );

    const result = await this.consumptionRepo.findOne({
      where: { id: consumptionId },
      relations: ['template', 'patient', 'doctor'],
    });
    if (!result) throw new NotFoundException('Consumption not found');
    return result;
  }

  async getByAppointment(
    appointmentId: string,
    organizationId: string,
  ): Promise<PatientConsumption | null> {
    return this.consumptionRepo.findOne({
      where: { appointmentId, organizationId },
      relations: ['template', 'doctor'],
      order: { createdAt: 'DESC' },
    });
  }

  async getByPatient(
    patientId: string,
    organizationId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponseDto<PatientConsumption>> {
    const qb = this.consumptionRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.template', 'template')
      .leftJoinAndSelect('c.doctor', 'doctor')
      .leftJoinAndSelect('c.items', 'items')
      .where('c.patientId = :patientId', { patientId })
      .andWhere('c.organizationId = :organizationId', { organizationId })
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginatedResponseDto.create(data, total, page, limit);
  }

  async getConsumptionReport(
    organizationId: string,
    locationId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<{
    mostConsumedItems: Array<{
      inventoryItemId: string;
      name: string;
      totalQuantity: number;
      totalCost: number;
    }>;
    totalCost: number;
    byDoctor: Array<{
      performedBy: string;
      consumptionCount: number;
      totalCost: number;
    }>;
    templateUsage: { fromTemplate: number; manual: number };
  }> {
    const applyDateRange = (qb: any, alias: string) => {
      if (dateFrom)
        qb.andWhere(`${alias}.createdAt >= :dateFrom`, { dateFrom });
      if (dateTo) qb.andWhere(`${alias}.createdAt <= :dateTo`, { dateTo });
      return qb;
    };

    // Most consumed items
    const itemsQb = this.consumptionItemRepo
      .createQueryBuilder('ci')
      .innerJoin('ci.consumption', 'c')
      .innerJoin('ci.inventoryItem', 'inv')
      .select('ci.inventoryItemId', 'inventoryItemId')
      .addSelect('inv.name', 'name')
      .addSelect('COALESCE(SUM(ci.quantity), 0)', 'totalQuantity')
      .addSelect('COALESCE(SUM(ci.totalPrice), 0)', 'totalCost')
      .where('c.organizationId = :organizationId', { organizationId })
      .andWhere('c.locationId = :locationId', { locationId })
      .groupBy('ci.inventoryItemId')
      .addGroupBy('inv.name')
      .orderBy('"totalQuantity"', 'DESC')
      .limit(10);
    applyDateRange(itemsQb, 'c');
    const itemRows = await itemsQb.getRawMany();

    // Total cost across consumptions
    const totalQb = this.consumptionRepo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.totalCost), 0)', 'total')
      .where('c.organizationId = :organizationId', { organizationId })
      .andWhere('c.locationId = :locationId', { locationId });
    applyDateRange(totalQb, 'c');
    const totalRow = await totalQb.getRawOne<{ total: string }>();

    // By doctor
    const doctorQb = this.consumptionRepo
      .createQueryBuilder('c')
      .select('c.performedBy', 'performedBy')
      .addSelect('COUNT(c.id)', 'consumptionCount')
      .addSelect('COALESCE(SUM(c.totalCost), 0)', 'totalCost')
      .where('c.organizationId = :organizationId', { organizationId })
      .andWhere('c.locationId = :locationId', { locationId })
      .groupBy('c.performedBy');
    applyDateRange(doctorQb, 'c');
    const doctorRows = await doctorQb.getRawMany();

    // Template usage (consumptions that used a template vs manual)
    const templateQb = this.consumptionRepo
      .createQueryBuilder('c')
      .select(
        'SUM(CASE WHEN c.templateId IS NOT NULL THEN 1 ELSE 0 END)',
        'fromTemplate',
      )
      .addSelect(
        'SUM(CASE WHEN c.templateId IS NULL THEN 1 ELSE 0 END)',
        'manual',
      )
      .where('c.organizationId = :organizationId', { organizationId })
      .andWhere('c.locationId = :locationId', { locationId });
    applyDateRange(templateQb, 'c');
    const templateRow = await templateQb.getRawOne<{
      fromTemplate: string;
      manual: string;
    }>();

    return {
      mostConsumedItems: itemRows.map((r) => ({
        inventoryItemId: r.inventoryItemId,
        name: r.name,
        totalQuantity: num(r.totalQuantity),
        totalCost: num(r.totalCost),
      })),
      totalCost: num(totalRow?.total),
      byDoctor: doctorRows.map((r) => ({
        performedBy: r.performedBy,
        consumptionCount: num(r.consumptionCount),
        totalCost: num(r.totalCost),
      })),
      templateUsage: {
        fromTemplate: num(templateRow?.fromTemplate),
        manual: num(templateRow?.manual),
      },
    };
  }
}
