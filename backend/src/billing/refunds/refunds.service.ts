import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import {
  AuditEntry,
  BillingAuditService,
} from '../audit/billing-audit.service';
import { DEFAULT_PAGE_SIZE } from '../billing.constants';
import { BillingClock, ClinicTime } from '../common/billing-clock.service';
import { assertBillingCan, BillingContext } from '../common/billing-context';
import { billingError, invariant, notFound } from '../common/billing-errors';
import { BillingLocks, paymentAdvancePaisa } from '../common/billing-locks';
import { BillingLookups, toPatientRef } from '../common/billing-lookups';
import { fromPaisa, toPaisa } from '../common/money';
import {
  CreateRefundDto,
  InvoiceRefundDto,
  ListRefundsQueryDto,
  RefundBodyDto,
} from '../dto/refund.dto';
import { Invoice } from '../entities/invoice.entity';
import { Payment } from '../entities/payment.entity';
import { Refund } from '../entities/refund.entity';
import { RefundSource } from '../entities/refund-source.entity';
import {
  BillingAuditAction,
  BillingAuditEntity,
  DocumentType,
  LedgerEntryType,
} from '../enums/billing.enums';
import {
  invoiceRefundStatus,
  refundablePaisa,
} from '../invoices/invoice-status';
import { InvoicesService } from '../invoices/invoices.service';
import { LedgerService } from '../ledger/ledger.service';
import { RefundResponse } from '../mappers/billing-response.types';
import { toRefundResponse } from '../mappers/payment.mapper';
import { DocumentSequenceService } from '../numbering/document-sequence.service';
import { PaymentAccountsService } from '../payment-accounts/payment-accounts.service';
import { BillingTotalsService } from '../totals/billing-totals.service';

/** Refunds, always from advance (D14, 6.10, 6.18). */
@Injectable()
export class RefundsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: BillingClock,
    private readonly accounts: PaymentAccountsService,
    private readonly sequences: DocumentSequenceService,
    private readonly invoices: InvoicesService,
    private readonly totals: BillingTotalsService,
    private readonly ledger: LedgerService,
    private readonly audit: BillingAuditService,
  ) {}

  /** Advance refund: never sets `invoiceId` (6.18 rule 5). Touches I2, I7. */
  async createAdvanceRefund(
    ctx: BillingContext,
    dto: CreateRefundDto,
  ): Promise<RefundResponse> {
    assertBillingCan(ctx.actor, 'billing.refund.issue');
    return this.idempotent(ctx, dto.clientRequestId, (manager) =>
      this.runRefund(manager, ctx, dto.patientId, dto, null),
    );
  }

  /** Optional invoice edit + refund recorded on the invoice, atomically (6.10, 6.18). Touches I9. */
  async createInvoiceRefund(
    ctx: BillingContext,
    invoiceId: string,
    dto: InvoiceRefundDto,
  ): Promise<RefundResponse> {
    assertBillingCan(ctx.actor, 'billing.refund.issue');
    return this.idempotent(ctx, dto.refund.clientRequestId, async (manager) => {
      if (dto.edit) {
        const time = await this.clock.read(ctx.tenant.locationId);
        await this.invoices.runEdit(
          manager,
          ctx,
          time,
          invoiceId,
          dto.edit,
          dto.edit.reason,
        );
      }
      const [invoice] = await BillingLocks.invoices(manager, ctx.tenant, [
        invoiceId,
      ]);
      return this.runRefund(
        manager,
        ctx,
        invoice.patientId,
        dto.refund,
        invoice,
      );
    });
  }

  async list(
    tenant: TenantContext,
    q: ListRefundsQueryDto,
  ): Promise<PaginatedResponseDto<RefundResponse>> {
    const page = q.page ?? 1;
    const limit = q.limit ?? DEFAULT_PAGE_SIZE;
    const qb = this.dataSource
      .getRepository(Refund)
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.patient', 'pt')
      .where('r.organization_id = :org AND r.location_id = :loc', {
        org: tenant.organizationId,
        loc: tenant.locationId,
      });
    if (q.from) qb.andWhere('r.refund_date >= :from', { from: q.from });
    if (q.to) qb.andWhere('r.refund_date <= :to', { to: q.to });
    if (q.patientId)
      qb.andWhere('r.patient_id = :patientId', { patientId: q.patientId });
    const [rows, total] = await qb
      .orderBy('r.refundedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const data = await this.views(this.dataSource.manager, rows);
    return PaginatedResponseDto.create(data, total, page, limit);
  }

  async detail(tenant: TenantContext, id: string): Promise<RefundResponse> {
    const r = await this.dataSource.getRepository(Refund).findOne({
      where: {
        id,
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
      },
      relations: { patient: true, sources: { payment: true } },
    });
    if (!r) throw notFound('Refund');
    const [view] = await this.views(this.dataSource.manager, [r]);
    return {
      ...view,
      sources: r.sources.map((s) => ({
        paymentId: s.paymentId,
        receiptNumber: s.payment.receiptNumber,
        amount: s.amount,
      })),
    };
  }

  // ─── algorithm (6.10) ──────────────────────────────────────────────

  private async runRefund(
    manager: EntityManager,
    ctx: BillingContext,
    patientId: string,
    body: RefundBodyDto,
    invoice: Invoice | null,
  ): Promise<string> {
    await BillingLookups.patient(manager, ctx.tenant, patientId);
    const account = await this.accounts.resolveForUse(
      manager,
      ctx.tenant,
      body.paymentAccountId,
      body.referenceNumber,
    );
    const amount = toPaisa(body.amount);

    if (invoice) {
      const fresh = await manager
        .getRepository(Invoice)
        .findOneByOrFail({ id: invoice.id });
      if (amount > refundablePaisa(fresh)) {
        throw billingError(
          'BILLING_REFUND_EXCEEDS_INVOICE_REFUNDABLE',
          `Only Rs ${fromPaisa(refundablePaisa(fresh))} can be refunded from this invoice`,
        );
      }
    }
    const payments = await BillingLocks.advancePayments(
      manager,
      ctx.tenant,
      patientId,
    );
    const available = payments.reduce((a, p) => a + paymentAdvancePaisa(p), 0);
    if (amount > available) {
      throw billingError(
        'BILLING_REFUND_EXCEEDS_ADVANCE',
        `The patient's advance is only Rs ${fromPaisa(available)}`,
      );
    }

    const ordered = await this.sourceOrder(
      manager,
      payments,
      invoice?.id ?? null,
    );
    const sources: Array<{ paymentId: string; amountPaisa: number }> = [];
    let left = amount;
    for (const p of ordered) {
      if (left === 0) break;
      const take = Math.min(left, paymentAdvancePaisa(p));
      if (take > 0) sources.push({ paymentId: p.id, amountPaisa: take });
      left -= take;
    }
    invariant(left === 0, 'Refund sources do not cover the amount');

    const time = await this.clock.read(ctx.tenant.locationId);
    const refund = await this.insertRefund(
      manager,
      ctx,
      time,
      patientId,
      body,
      account,
      invoice?.id ?? null,
    );
    await manager.getRepository(RefundSource).insert(
      sources.map((s) => ({
        organizationId: ctx.tenant.organizationId,
        refundId: refund.id,
        paymentId: s.paymentId,
        amount: fromPaisa(s.amountPaisa),
      })),
    );
    await this.totals.recomputePayments(
      manager,
      sources.map((s) => s.paymentId),
    );
    if (invoice) await this.totals.recomputeInvoices(manager, [invoice.id]);

    await this.ledger.post(manager, ctx, {
      patientId,
      type: LedgerEntryType.REFUND,
      entryDate: time.today,
      amount: refund.amount,
      description: invoice
        ? `Refund ${refund.refundNumber} against ${invoice.invoiceNumber}`
        : `Refund ${refund.refundNumber} (advance)`,
      refundId: refund.id,
      invoiceId: invoice?.id ?? null,
    });
    await this.auditRefund(manager, ctx, refund, sources, invoice);
    return refund.id;
  }

  /**
   * Invoice refunds draw first from payments released from that invoice
   * (latest release first), then any advance newest first (6.18 rule 3).
   */
  private async sourceOrder(
    manager: EntityManager,
    payments: Payment[],
    invoiceId: string | null,
  ): Promise<Payment[]> {
    const newestFirst = [...payments].sort(
      (a, b) =>
        b.paymentDate.localeCompare(a.paymentDate) ||
        b.receivedAt.getTime() - a.receivedAt.getTime(),
    );
    if (!invoiceId) return newestFirst;
    const released: Array<{ payment_id: string }> = await manager.query(
      `SELECT payment_id FROM payment_allocations
        WHERE invoice_id = $1 AND amount < 0
        GROUP BY payment_id ORDER BY MAX(created_at) DESC`,
      [invoiceId],
    );
    const rank = new Map(released.map((r, i) => [r.payment_id, i]));
    const first = newestFirst
      .filter((p) => rank.has(p.id))
      .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    return [...first, ...newestFirst.filter((p) => !rank.has(p.id))];
  }

  private async insertRefund(
    manager: EntityManager,
    ctx: BillingContext,
    time: ClinicTime,
    patientId: string,
    body: RefundBodyDto,
    account: { id: string; name: string; method: Refund['method'] },
    invoiceId: string | null,
  ): Promise<Refund> {
    const repo = manager.getRepository(Refund);
    return repo.save(
      repo.create({
        organizationId: ctx.tenant.organizationId,
        locationId: ctx.tenant.locationId,
        patientId,
        refundNumber: await this.sequences.next(
          manager,
          ctx.tenant,
          DocumentType.REFUND,
          time.today,
        ),
        amount: body.amount,
        paymentAccountId: account.id,
        method: account.method,
        paymentAccountName: account.name,
        referenceNumber: body.referenceNumber?.trim() || null,
        reason: body.reason,
        refundDate: time.today,
        refundedAt: time.now,
        refundedBy: ctx.actor.userId,
        invoiceId,
        clientRequestId: body.clientRequestId,
      }),
    );
  }

  private async auditRefund(
    manager: EntityManager,
    ctx: BillingContext,
    refund: Refund,
    sources: Array<{ paymentId: string; amountPaisa: number }>,
    invoice: Invoice | null,
  ): Promise<void> {
    const entries: AuditEntry[] = [
      {
        entityType: BillingAuditEntity.REFUND,
        entityId: refund.id,
        action: BillingAuditAction.REFUNDED,
        after: {
          ...refund,
          sources: sources.map((s) => ({
            ...s,
            amount: fromPaisa(s.amountPaisa),
          })),
        },
        reason: refund.reason,
        amount: refund.amount,
      },
    ];
    if (invoice) {
      const fresh = await manager
        .getRepository(Invoice)
        .findOneByOrFail({ id: invoice.id });
      entries.push({
        entityType: BillingAuditEntity.INVOICE,
        entityId: invoice.id,
        action: BillingAuditAction.REFUNDED,
        after: {
          releasedAmount: fresh.releasedAmount,
          refundedAmount: fresh.refundedAmount,
          refundStatus: invoiceRefundStatus(fresh),
          refundId: refund.id,
        },
        reason: refund.reason,
        amount: refund.amount,
      });
    }
    await this.audit.logMany(manager, ctx, entries);
  }

  private async idempotent(
    ctx: BillingContext,
    clientRequestId: string,
    work: (manager: EntityManager) => Promise<string>,
  ): Promise<RefundResponse> {
    const find = () =>
      this.dataSource.getRepository(Refund).findOne({
        where: { organizationId: ctx.tenant.organizationId, clientRequestId },
        select: { id: true },
      });
    const existing = await find();
    if (existing) return this.detail(ctx.tenant, existing.id);
    try {
      const id = await this.dataSource.transaction(work);
      return this.detail(ctx.tenant, id);
    } catch (err) {
      // Losing a parallel retry surfaces as the unique index or, once the
      // winner committed, as BILLING_REFUND_EXCEEDS_ADVANCE; replay the winner.
      const winner = await find();
      if (!winner) throw err;
      return this.detail(ctx.tenant, winner.id);
    }
  }

  private async views(
    manager: EntityManager,
    rows: Refund[],
  ): Promise<RefundResponse[]> {
    const names = await BillingLookups.userNames(
      manager,
      rows.map((r) => r.refundedBy),
    );
    const invoiceIds = rows
      .map((r) => r.invoiceId)
      .filter((x): x is string => !!x);
    const invoices = invoiceIds.length
      ? await manager.getRepository(Invoice).find({
          where: invoiceIds.map((id) => ({ id })),
          select: { id: true, invoiceNumber: true },
        })
      : [];
    const numbers = new Map(invoices.map((i) => [i.id, i.invoiceNumber]));
    return rows.map((r) =>
      toRefundResponse(
        r,
        toPatientRef(r.patient),
        names.get(r.refundedBy) ?? null,
        numbers.get(r.invoiceId ?? '') ?? null,
      ),
    );
  }
}
