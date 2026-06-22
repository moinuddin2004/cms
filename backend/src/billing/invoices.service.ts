import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { AppLogger } from 'src/common/services/logger.service';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Coupon } from './entities/coupon.entity';
import { PatientTreatmentPlan } from 'src/patients/entities/patient-treatment-plan.entity';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  AddInvoiceItemDto,
  InvoiceFilterDto,
} from './dto/invoice.dto';
import {
  InvoiceStatus,
  DiscountType,
  VALID_INVOICE_TRANSITIONS,
} from './enums/billing.enums';

/** TypeORM returns decimals as strings; coerce safely. */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly itemRepo: Repository<InvoiceItem>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(PatientTreatmentPlan)
    private readonly treatmentPlanRepo: Repository<PatientTreatmentPlan>,
    private readonly logger: AppLogger,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────

  private async generateInvoiceNumber(organizationId: string): Promise<string> {
    const last = await this.invoiceRepo.findOne({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    const year = new Date().getFullYear();
    let seq = 1;
    if (last?.invoiceNumber) {
      const parts = last.invoiceNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!Number.isNaN(lastSeq)) seq = lastSeq + 1;
    }
    return `INV-${year}-${String(seq).padStart(5, '0')}`;
  }

  /** Recompute subtotal/discount/tax/total/balance from items + apply, then save. */
  async recalculateTotals(invoice: Invoice): Promise<Invoice> {
    const items = invoice.items ?? (await this.itemRepo.find({ where: { invoiceId: invoice.id } }));

    const subtotal = round2(
      items.reduce((sum, it) => sum + num(it.totalPrice), 0),
    );

    let discountAmount = 0;
    if (invoice.discountType === DiscountType.PERCENTAGE) {
      discountAmount = round2(subtotal * (num(invoice.discountValue) / 100));
      if (invoice.couponId) {
        const coupon = await this.couponRepo.findOne({
          where: { id: invoice.couponId },
        });
        if (coupon?.maxDiscountAmount != null) {
          discountAmount = Math.min(
            discountAmount,
            num(coupon.maxDiscountAmount),
          );
        }
      }
    } else if (invoice.discountType === DiscountType.FIXED) {
      discountAmount = num(invoice.discountValue);
    }
    discountAmount = Math.min(discountAmount, subtotal); // never exceed subtotal

    const taxableBase = subtotal - discountAmount;
    const taxAmount = round2(taxableBase * (num(invoice.taxRate) / 100));
    const totalAmount = round2(subtotal - discountAmount + taxAmount);
    const balanceDue = round2(totalAmount - num(invoice.paidAmount));

    invoice.subtotal = subtotal;
    invoice.discountAmount = discountAmount;
    invoice.taxAmount = taxAmount;
    invoice.totalAmount = totalAmount;
    invoice.balanceDue = balanceDue;

    return this.invoiceRepo.save(invoice);
  }

  private assertDraft(invoice: Invoice): void {
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft invoices can be edited. Cancel and recreate instead.',
      );
    }
  }

  private async getOrFail(
    id: string,
    organizationId: string,
    locationId: string,
    relations: string[] = [],
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id, organizationId, locationId },
      relations,
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  // ── CRUD ───────────────────────────────────────────────────────────

  async create(
    ctx: TenantContext,
    dto: CreateInvoiceDto,
    createdBy: string,
  ): Promise<Invoice> {
    const { organizationId, locationId } = ctx;

    const invoiceNumber = await this.generateInvoiceNumber(organizationId);

    // Build items either from a treatment plan or from supplied manual items.
    let items: InvoiceItem[] = [];
    if (dto.treatmentPlanId) {
      const plan = await this.treatmentPlanRepo.findOne({
        where: { id: dto.treatmentPlanId, organizationId },
        relations: ['items'],
      });
      if (!plan) throw new NotFoundException('Treatment plan not found');
      items = (plan.items ?? []).map((pi, idx) =>
        this.itemRepo.create({
          treatmentPlanItemId: pi.id,
          description: pi.procedureName,
          quantity: 1,
          unitPrice: num(pi.estimatedCost),
          totalPrice: round2(num(pi.estimatedCost)),
          sortOrder: idx,
        }),
      );
    } else if (dto.items?.length) {
      items = dto.items.map((it, idx) =>
        this.itemRepo.create({
          treatmentPlanItemId: it.treatmentPlanItemId ?? null,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          totalPrice: round2(it.quantity * it.unitPrice),
          sortOrder: idx,
        }),
      );
    }

    const today = new Date();
    const due = dto.dueDate
      ? new Date(dto.dueDate)
      : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const invoice = this.invoiceRepo.create({
      invoiceNumber,
      organizationId,
      locationId,
      patientId: dto.patientId,
      treatmentPlanId: dto.treatmentPlanId ?? null,
      createdBy,
      status: InvoiceStatus.DRAFT,
      issuedDate: today,
      dueDate: due,
      notes: dto.notes ?? null,
      items,
    });

    const saved = await this.invoiceRepo.save(invoice);
    // items were cascade-saved; reload with items for accurate totals
    saved.items = await this.itemRepo.find({ where: { invoiceId: saved.id } });
    await this.recalculateTotals(saved);
    return this.findOne(saved.id, organizationId, locationId);
  }

  async findAll(
    ctx: TenantContext,
    filters: InvoiceFilterDto,
  ): Promise<PaginatedResponseDto<Invoice>> {
    const { organizationId, locationId } = ctx;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const qb = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.patient', 'patient')
      .where('invoice.organization_id = :organizationId', { organizationId })
      .andWhere('invoice.location_id = :locationId', { locationId });

    if (filters.status)
      qb.andWhere('invoice.status = :status', { status: filters.status });
    if (filters.patientId)
      qb.andWhere('invoice.patient_id = :patientId', {
        patientId: filters.patientId,
      });
    if (filters.dateFrom)
      qb.andWhere('invoice.issued_date >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    if (filters.dateTo)
      qb.andWhere('invoice.issued_date <= :dateTo', { dateTo: filters.dateTo });

    qb.orderBy('invoice.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginatedResponseDto.create(data, total, page, limit);
  }

  async findOne(
    id: string,
    organizationId: string,
    locationId: string,
  ): Promise<Invoice> {
    const invoice = await this.getOrFail(id, organizationId, locationId, [
      'items',
      'payments',
      'patient',
      'creator',
      'coupon',
    ]);
    invoice.items = (invoice.items ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    invoice.payments = (invoice.payments ?? []).sort(
      (a, b) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime(),
    );
    return invoice;
  }

  async update(
    id: string,
    ctx: TenantContext,
    dto: UpdateInvoiceDto,
  ): Promise<Invoice> {
    const invoice = await this.getOrFail(
      id,
      ctx.organizationId,
      ctx.locationId,
      ['items'],
    );
    this.assertDraft(invoice);

    if (dto.dueDate !== undefined) invoice.dueDate = new Date(dto.dueDate);
    if (dto.notes !== undefined) invoice.notes = dto.notes;
    if (dto.discountType !== undefined) invoice.discountType = dto.discountType;
    if (dto.discountValue !== undefined)
      invoice.discountValue = dto.discountValue;
    if (dto.taxRate !== undefined) invoice.taxRate = dto.taxRate;

    await this.recalculateTotals(invoice);
    return this.findOne(id, ctx.organizationId, ctx.locationId);
  }

  async addItem(
    id: string,
    ctx: TenantContext,
    dto: AddInvoiceItemDto,
  ): Promise<Invoice> {
    const invoice = await this.getOrFail(
      id,
      ctx.organizationId,
      ctx.locationId,
      ['items'],
    );
    this.assertDraft(invoice);

    const item = this.itemRepo.create({
      invoiceId: invoice.id,
      treatmentPlanItemId: dto.treatmentPlanItemId ?? null,
      description: dto.description,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      totalPrice: round2(dto.quantity * dto.unitPrice),
      sortOrder: invoice.items?.length ?? 0,
    });
    await this.itemRepo.save(item);

    invoice.items = await this.itemRepo.find({ where: { invoiceId: id } });
    await this.recalculateTotals(invoice);
    return this.findOne(id, ctx.organizationId, ctx.locationId);
  }

  async removeItem(
    id: string,
    itemId: string,
    ctx: TenantContext,
  ): Promise<Invoice> {
    const invoice = await this.getOrFail(
      id,
      ctx.organizationId,
      ctx.locationId,
      ['items'],
    );
    this.assertDraft(invoice);

    const item = await this.itemRepo.findOne({
      where: { id: itemId, invoiceId: id },
    });
    if (!item) throw new NotFoundException('Invoice item not found');
    await this.itemRepo.remove(item);

    invoice.items = await this.itemRepo.find({ where: { invoiceId: id } });
    await this.recalculateTotals(invoice);
    return this.findOne(id, ctx.organizationId, ctx.locationId);
  }

  async updateStatus(
    id: string,
    ctx: TenantContext,
    newStatus: InvoiceStatus,
  ): Promise<Invoice> {
    const invoice = await this.getOrFail(id, ctx.organizationId, ctx.locationId);

    const allowed = VALID_INVOICE_TRANSITIONS[invoice.status] ?? [];
    if (invoice.status !== newStatus && !allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${invoice.status} → ${newStatus}`,
      );
    }

    invoice.status = newStatus;
    if (newStatus === InvoiceStatus.PENDING && !invoice.issuedDate) {
      invoice.issuedDate = new Date();
    }
    if (newStatus === InvoiceStatus.PAID) {
      invoice.paidDate = new Date();
    }
    await this.invoiceRepo.save(invoice);
    return this.findOne(id, ctx.organizationId, ctx.locationId);
  }

  async generateFromTreatmentPlan(
    treatmentPlanId: string,
    ctx: TenantContext,
    createdBy: string,
  ): Promise<Invoice> {
    const existing = await this.invoiceRepo.findOne({
      where: {
        treatmentPlanId,
        organizationId: ctx.organizationId,
        status: In([
          InvoiceStatus.DRAFT,
          InvoiceStatus.PENDING,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.PAID,
          InvoiceStatus.OVERDUE,
        ]),
      },
    });
    if (existing) {
      throw new BadRequestException(
        'An active invoice already exists for this treatment plan',
      );
    }

    const plan = await this.treatmentPlanRepo.findOne({
      where: { id: treatmentPlanId, organizationId: ctx.organizationId },
    });
    if (!plan) throw new NotFoundException('Treatment plan not found');

    return this.create(
      ctx,
      { patientId: plan.patientId, treatmentPlanId },
      createdBy,
    );
  }

  async getStats(ctx: TenantContext): Promise<{
    totalInvoices: number;
    totalRevenue: number;
    outstandingAmount: number;
    overdueCount: number;
  }> {
    const { organizationId, locationId } = ctx;
    const base = { organizationId, locationId };

    const totalInvoices = await this.invoiceRepo.count({ where: base });

    const revenueRow = await this.invoiceRepo
      .createQueryBuilder('i')
      .select('COALESCE(SUM(i.paid_amount), 0)', 'sum')
      .where('i.organization_id = :organizationId', { organizationId })
      .andWhere('i.location_id = :locationId', { locationId })
      .andWhere('i.status IN (:...statuses)', {
        statuses: [InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID],
      })
      .getRawOne();

    const outstandingRow = await this.invoiceRepo
      .createQueryBuilder('i')
      .select('COALESCE(SUM(i.balance_due), 0)', 'sum')
      .where('i.organization_id = :organizationId', { organizationId })
      .andWhere('i.location_id = :locationId', { locationId })
      .andWhere('i.status IN (:...statuses)', {
        statuses: [
          InvoiceStatus.PENDING,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.OVERDUE,
        ],
      })
      .getRawOne();

    const overdueCount = await this.invoiceRepo.count({
      where: { ...base, status: InvoiceStatus.OVERDUE },
    });

    return {
      totalInvoices,
      totalRevenue: num(revenueRow?.sum),
      outstandingAmount: num(outstandingRow?.sum),
      overdueCount,
    };
  }

  // ── Scheduled: auto-mark overdue invoices daily at midnight ─────────

  @Cron('0 0 * * *')
  async markOverdueInvoices(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const candidates = await this.invoiceRepo.find({
      where: {
        status: In([InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID]),
        dueDate: LessThan(today),
      },
    });
    if (candidates.length === 0) return;

    for (const inv of candidates) {
      inv.status = InvoiceStatus.OVERDUE;
    }
    await this.invoiceRepo.save(candidates);
    this.logger.info(
      `Marked ${candidates.length} invoice(s) as OVERDUE`,
      InvoicesService.name,
    );
  }
}
