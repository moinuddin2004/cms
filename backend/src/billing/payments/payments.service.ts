import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { BillingAuditService } from '../audit/billing-audit.service';
import { BillingClock, ClinicTime } from '../common/billing-clock.service';
import { BillingContext } from '../common/billing-context';
import { billingError } from '../common/billing-errors';
import { BillingLocks, paymentAdvancePaisa } from '../common/billing-locks';
import { BillingLookups } from '../common/billing-lookups';
import { fromPaisa, toPaisa } from '../common/money';
import { chargeBalancePaisa } from '../charges/charge-math';
import {
  ApplyAdvanceDto,
  CollectPaymentDto,
  ListPaymentsQueryDto,
  PreviewPaymentDto,
  UnapplyPaymentDto,
} from '../dto/payment.dto';
import { Charge } from '../entities/charge.entity';
import { Invoice } from '../entities/invoice.entity';
import { Payment } from '../entities/payment.entity';
import {
  AllocationMode,
  AllocationReason,
  BillingAuditAction,
  BillingAuditEntity,
  ChargeStatus,
  DocumentType,
  InvoiceStatus,
  LedgerEntryType,
} from '../enums/billing.enums';
import { InvoiceIssuer } from '../invoices/invoice-issuer.service';
import { LedgerService } from '../ledger/ledger.service';
import {
  PatientBillingSummary,
  PaymentResponse,
} from '../mappers/billing-response.types';
import { toPaymentResponse } from '../mappers/payment.mapper';
import { DocumentSequenceService } from '../numbering/document-sequence.service';
import { PatientBillingQueries } from '../patient-billing/patient-billing.queries';
import { PaymentAccountsService } from '../payment-accounts/payment-accounts.service';
import { BillingTotalsService } from '../totals/billing-totals.service';
import {
  AllocationPlan,
  AllocationPlanError,
  FundSource,
  NEW_PAYMENT,
  planAllocation,
} from './allocation/allocation-planner';
import { AllocationWriterService } from './allocation-writer.service';
import { CommissionService } from '../commissions/commission.service';
import {
  COMMISSIONS_FEATURE,
  CommissionSourceType,
} from '../commissions/commission.enums';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import {
  DailyCollection,
  PaymentDetail,
  PaymentQueries,
} from './payments.queries';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';

export interface CollectResult {
  payment: PaymentResponse | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  allocations: Array<{
    chargeId: string;
    invoiceNumber: string | null;
    source: 'NEW' | 'ADVANCE';
    amount: number;
  }>;
  summary: PatientBillingSummary;
}

export interface PaymentPreview {
  totalSelectedBalance: number;
  advanceAvailable: number;
  advanceUsed: number;
  payingNow: number;
  toAdvance: number;
  /** What the new payment must be to clear the selection. */
  amountToClearSelected: number;
  invoiceWillBeIssued: boolean;
  willInvoice: Array<{
    chargeId: string;
    description: string;
    netAmount: number;
  }>;
  willInvoiceTotal: number;
  lines: Array<{
    chargeId: string;
    description: string;
    invoiceNumber: string | null;
    source: 'NEW' | 'ADVANCE';
    amount: number;
  }>;
  blockers: Array<{
    chargeId: string;
    description: string;
    reason: 'NEEDS_PRICING';
  }>;
  /**
   * Admin only, with doctor commissions on: commission this collection
   * would record, per doctor, in paisa. Internal — never on receipts.
   */
  doctorShare: {
    totalPaisa: number;
    byDoctor: Array<{
      assignmentId: string;
      doctorName: string;
      amountPaisa: number;
    }>;
  } | null;
}

interface Selection {
  chargeId: string;
  amount?: number;
}

/** Collect, preview, apply advance, unapply (D3, D6, D7, D13; 6.5, 6.9). */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: BillingClock,
    private readonly accounts: PaymentAccountsService,
    private readonly sequences: DocumentSequenceService,
    private readonly issuer: InvoiceIssuer,
    private readonly writer: AllocationWriterService,
    private readonly totals: BillingTotalsService,
    private readonly ledger: LedgerService,
    private readonly audit: BillingAuditService,
    private readonly commissions: CommissionService,
    private readonly flags: FeatureFlagsService,
  ) {}

  /**
   * Collect a payment (6.5). One transaction: lock → plan → auto-invoice →
   * payment + allocations → totals → ledger → audit. Idempotent by
   * `clientRequestId`. Touches I1–I5.
   */
  async collect(
    ctx: BillingContext,
    dto: CollectPaymentDto,
  ): Promise<CollectResult> {
    const existing = await this.findByClientRequest(
      ctx.tenant,
      dto.clientRequestId,
    );
    if (existing) return this.resultFor(ctx.tenant, existing, null);
    try {
      return await this.dataSource.transaction((manager) =>
        this.runCollect(manager, ctx, dto),
      );
    } catch (err) {
      // A parallel retry can lose in two ways: the unique index on
      // `clientRequestId`, or — once the winner committed — a lock re-check
      // that now finds the charges taken (BILLING_CHARGE_NOT_OPEN). Either
      // way, when a payment with this id exists the caller gets that one.
      const winner = await this.findByClientRequest(
        ctx.tenant,
        dto.clientRequestId,
      );
      if (!winner) throw err;
      return this.resultFor(ctx.tenant, winner, null);
    }
  }

  /** Apply existing advance only — no new money, no receipt (6.5). */
  async applyAdvance(
    ctx: BillingContext,
    patientId: string,
    dto: ApplyAdvanceDto,
  ): Promise<CollectResult> {
    return this.dataSource.transaction((manager) =>
      this.runCollect(manager, ctx, {
        ...dto,
        patientId,
        amount: 0,
        applyAdvance: true,
      }),
    );
  }

  /** Steps 2 and 4 without locks or writes (6.5 "Preview"). */
  async preview(
    ctx: BillingContext,
    dto: PreviewPaymentDto,
  ): Promise<PaymentPreview> {
    const manager = this.dataSource.manager;
    await BillingLookups.patient(manager, ctx.tenant, dto.patientId);
    const charges = await this.loadOpenCharges(
      manager,
      ctx.tenant,
      dto.patientId,
      dto.selections,
    );
    const advance = dto.applyAdvance
      ? await this.advanceSources(manager, ctx.tenant, dto.patientId)
      : [];
    const plan = this.plan(
      dto.mode,
      charges,
      dto.selections,
      advance,
      toPaisa(dto.amount),
    );
    const invoices = await this.invoiceNumbers(manager, charges);

    const unbilled = charges.filter((c) => !c.invoiceId);
    const totalBalance = charges.reduce((a, c) => a + chargeBalancePaisa(c), 0);
    const advanceAvailable = advance.reduce((a, f) => a + f.availablePaisa, 0);
    const byId = new Map(charges.map((c) => [c.id, c]));
    return {
      totalSelectedBalance: fromPaisa(totalBalance),
      advanceAvailable: fromPaisa(advanceAvailable),
      advanceUsed: fromPaisa(plan.advanceUsedPaisa),
      payingNow: fromPaisa(toPaisa(dto.amount) - plan.newPaymentAdvancePaisa),
      toAdvance: fromPaisa(plan.newPaymentAdvancePaisa),
      amountToClearSelected: fromPaisa(
        Math.max(0, totalBalance - advanceAvailable),
      ),
      invoiceWillBeIssued: unbilled.length > 0,
      willInvoice: unbilled.map((c) => ({
        chargeId: c.id,
        description: c.description,
        netAmount: c.netAmount,
      })),
      willInvoiceTotal: fromPaisa(
        unbilled.reduce((a, c) => a + toPaisa(c.netAmount), 0),
      ),
      lines: plan.lines.map((l) => ({
        chargeId: l.chargeId,
        description: byId.get(l.chargeId)?.description ?? '',
        invoiceNumber:
          invoices.get(byId.get(l.chargeId)?.invoiceId ?? '') ?? null,
        source: l.source === NEW_PAYMENT ? 'NEW' : 'ADVANCE',
        amount: fromPaisa(l.amountPaisa),
      })),
      blockers: unbilled
        .filter((c) => c.needsPricing)
        .map((c) => ({
          chargeId: c.id,
          description: c.description,
          reason: 'NEEDS_PRICING' as const,
        })),
      doctorShare:
        ctx.actor.isAdmin &&
        (await this.flags.isFeatureEnabled(
          ctx.tenant.organizationId,
          COMMISSIONS_FEATURE,
        ))
          ? await this.commissions.previewForAllocations(
              manager,
              plan.lines.map((l) => ({
                chargeId: l.chargeId,
                amountPaisa: l.amountPaisa,
              })),
            )
          : null,
    };
  }

  list(
    tenant: TenantContext,
    q: ListPaymentsQueryDto,
  ): Promise<PaginatedResponseDto<PaymentResponse>> {
    return PaymentQueries.list(this.dataSource.manager, tenant, q);
  }

  detail(tenant: TenantContext, id: string): Promise<PaymentDetail> {
    return PaymentQueries.detail(this.dataSource.manager, tenant, id);
  }

  async dailyCollection(
    tenant: TenantContext,
    date?: string,
  ): Promise<DailyCollection> {
    const day = date ?? (await this.clock.read(tenant.locationId)).today;
    return PaymentQueries.dailyCollection(this.dataSource.manager, tenant, day);
  }

  /** Release a payment's allocations back to advance (D13, 6.9). No ledger entry. */
  async unapply(
    ctx: BillingContext,
    paymentId: string,
    dto: UnapplyPaymentDto,
  ): Promise<PaymentResponse> {
    await this.dataSource.transaction(async (manager) => {
      const ref = await manager.getRepository(Payment).findOne({
        where: {
          id: paymentId,
          organizationId: ctx.tenant.organizationId,
          locationId: ctx.tenant.locationId,
        },
        select: { id: true },
      });
      if (!ref) throw billingError('BILLING_NOT_FOUND', 'Payment not found');
      const nets = await this.writer.netAllocations(manager, { paymentId });
      const chargeIds =
        dto.lines?.map((l) => l.chargeId) ?? nets.map((n) => n.chargeId);
      if (!chargeIds.length) {
        throw billingError(
          'BILLING_UNAPPLY_EXCEEDS_ALLOCATION',
          'Nothing of this payment is applied',
        );
      }
      const { charges, invoices } = await BillingLocks.chargesWithInvoices(
        manager,
        ctx.tenant,
        chargeIds,
      );
      await BillingLocks.payments(manager, ctx.tenant, [paymentId]);
      const released = await this.writer.releaseFromPayment(
        manager,
        ctx,
        paymentId,
        new Map(charges.map((c) => [c.id, c])),
        dto.lines?.map((l) => ({
          chargeId: l.chargeId,
          amountPaisa: toPaisa(l.amount),
        })) ?? null,
        dto.reason,
      );
      await this.totals.recomputeCharges(manager, chargeIds);
      await this.totals.recomputeInvoices(
        manager,
        invoices.map((i) => i.id),
      );
      await this.totals.recomputePayments(manager, [paymentId]);
      // Released money reverses its commission (a negative entry; settled
      // entries stay as they are and the reversal goes to the next period).
      await this.commissions.recordForCharges(manager, chargeIds, {
        type: CommissionSourceType.UNAPPLY,
      });
      await this.audit.log(manager, ctx, {
        entityType: BillingAuditEntity.PAYMENT,
        entityId: paymentId,
        action: BillingAuditAction.UNAPPLIED,
        after: { chargeIds, released: fromPaisa(released) },
        reason: dto.reason,
        amount: fromPaisa(released),
      });
    });
    const payment = await this.dataSource
      .getRepository(Payment)
      .findOneByOrFail({ id: paymentId });
    return this.paymentView(this.dataSource.manager, ctx.tenant, payment);
  }

  // ─── the collect algorithm ──────────────────────────────────────────

  private async runCollect(
    manager: EntityManager,
    ctx: BillingContext,
    dto: PreviewPaymentDto &
      Partial<
        Pick<CollectPaymentDto, 'referenceNumber' | 'notes' | 'clientRequestId'>
      >,
  ): Promise<CollectResult> {
    const isNewMoney = toPaisa(dto.amount) > 0;
    await BillingLookups.patient(manager, ctx.tenant, dto.patientId);
    const account = isNewMoney
      ? await this.accounts.resolveForUse(
          manager,
          ctx.tenant,
          dto.paymentAccountId ?? '',
          dto.referenceNumber,
        )
      : null;

    // Lock order (6.17): invoices → charges → payments.
    const ids = dto.selections.map((s) => s.chargeId);
    const { charges, invoices } = await BillingLocks.chargesWithInvoices(
      manager,
      ctx.tenant,
      ids,
    );
    this.assertCollectable(dto.patientId, charges, invoices);
    const advancePayments = dto.applyAdvance
      ? await BillingLocks.advancePayments(manager, ctx.tenant, dto.patientId)
      : [];
    const advance = this.fundsFrom(advancePayments);
    const plan = this.plan(
      dto.mode,
      charges,
      dto.selections,
      advance,
      toPaisa(dto.amount),
    );
    if (!isNewMoney && plan.lines.length === 0) {
      throw billingError(
        'BILLING_NOTHING_TO_APPLY',
        'There is no advance to apply to these charges',
      );
    }

    const time = await this.clock.read(ctx.tenant.locationId);
    const unbilled = charges.filter((c) => !c.invoiceId);
    const invoice = unbilled.length
      ? await this.issuer.issue(manager, ctx, time, unbilled)
      : null;

    const payment = account
      ? await this.insertPayment(manager, ctx, time, dto, account)
      : null;
    const byId = new Map(charges.map((c) => [c.id, c]));
    await this.writer.insert(
      manager,
      ctx,
      plan.lines.map((l) => ({
        paymentId:
          l.source === NEW_PAYMENT ? (payment as Payment).id : l.source,
        charge: byId.get(l.chargeId) as Charge,
        amountPaisa: l.amountPaisa,
        reason:
          l.source === NEW_PAYMENT
            ? AllocationReason.PAYMENT
            : AllocationReason.ADVANCE_APPLIED,
      })),
    );

    const touchedPayments = [
      ...(payment ? [payment.id] : []),
      ...plan.lines
        .filter((l) => l.source !== NEW_PAYMENT)
        .map((l) => l.source),
    ];
    await this.totals.recomputeCharges(manager, ids);
    await this.totals.recomputeInvoices(manager, [
      ...invoices.map((i) => i.id),
      invoice?.id ?? null,
    ]);
    await this.totals.recomputePayments(manager, touchedPayments);
    // Commission is earned on collection — new money and old advance
    // (FIFO) alike, at allocation time. Source = the new payment when there
    // is one, else this apply-advance operation.
    await this.commissions.recordForCharges(manager, ids, {
      type: CommissionSourceType.ALLOCATION,
      id: payment?.id,
    });

    if (payment) {
      await this.ledger.post(manager, ctx, {
        patientId: dto.patientId,
        type: LedgerEntryType.PAYMENT,
        entryDate: time.today,
        amount: -payment.amount,
        description: `Payment ${payment.receiptNumber} (${payment.paymentAccountName})`,
        paymentId: payment.id,
      });
    }
    await this.audit.log(manager, ctx, {
      entityType: BillingAuditEntity.PAYMENT,
      entityId: payment?.id ?? dto.patientId,
      action: payment
        ? BillingAuditAction.CREATED
        : BillingAuditAction.ALLOCATED,
      after: {
        payment: payment ? { ...payment } : null,
        allocations: plan.lines.map((l) => ({
          ...l,
          amount: fromPaisa(l.amountPaisa),
        })),
      },
      amount: payment?.amount ?? fromPaisa(plan.advanceUsedPaisa),
    });

    const fresh = payment
      ? await manager.getRepository(Payment).findOneByOrFail({ id: payment.id })
      : null;
    return this.resultFor(ctx.tenant, fresh, {
      plan,
      invoice,
      manager,
      patientId: dto.patientId,
      charges,
    });
  }

  private async insertPayment(
    manager: EntityManager,
    ctx: BillingContext,
    time: ClinicTime,
    dto: PreviewPaymentDto &
      Partial<
        Pick<CollectPaymentDto, 'referenceNumber' | 'notes' | 'clientRequestId'>
      >,
    account: { id: string; name: string; method: Payment['method'] },
  ): Promise<Payment> {
    const receiptNumber = await this.sequences.next(
      manager,
      ctx.tenant,
      DocumentType.RECEIPT,
      time.today,
    );
    const repo = manager.getRepository(Payment);
    const payment = repo.create({
      organizationId: ctx.tenant.organizationId,
      locationId: ctx.tenant.locationId,
      patientId: dto.patientId,
      receiptNumber,
      amount: dto.amount,
      paymentAccountId: account.id,
      method: account.method,
      paymentAccountName: account.name,
      referenceNumber: dto.referenceNumber?.trim() || null,
      paymentDate: time.today,
      receivedAt: time.now,
      receivedBy: ctx.actor.userId,
      notes: dto.notes?.trim() || null,
      clientRequestId: dto.clientRequestId,
    });
    return repo.save(payment);
  }

  /** Each selected charge: same patient, ACTIVE, balance > 0, invoice ISSUED. */
  private assertCollectable(
    patientId: string,
    charges: Charge[],
    invoices: Invoice[],
  ): void {
    const cancelled = new Set(
      invoices
        .filter((i) => i.status !== InvoiceStatus.ISSUED)
        .map((i) => i.id),
    );
    for (const c of charges) {
      // An unbilled charge still waiting for a price may sit at Rs 0; let it
      // through so preview reports it as a blocker and issuing rejects it
      // with BILLING_CHARGE_NEEDS_PRICING.
      const awaitingPrice = c.needsPricing && !c.invoiceId;
      if (
        c.patientId !== patientId ||
        c.status !== ChargeStatus.ACTIVE ||
        (chargeBalancePaisa(c) <= 0 && !awaitingPrice)
      ) {
        throw billingError(
          'BILLING_CHARGE_NOT_OPEN',
          `${c.description} has nothing left to pay`,
        );
      }
      if (c.invoiceId && cancelled.has(c.invoiceId)) {
        throw billingError(
          'BILLING_INVOICE_CANCELLED',
          'A selected charge is on a cancelled invoice',
        );
      }
    }
  }

  private plan(
    mode: AllocationMode,
    charges: Charge[],
    selections: Selection[],
    advance: FundSource[],
    newPaisa: number,
  ): AllocationPlan {
    if (
      mode === AllocationMode.MANUAL &&
      selections.some((s) => s.amount == null)
    ) {
      throw billingError(
        'BILLING_CHARGE_INVALID',
        'Enter an amount for every selected charge',
      );
    }
    try {
      return planAllocation(mode, {
        charges: charges.map((c) => ({
          id: c.id,
          chargeDate: c.chargeDate,
          createdAt: c.createdAt.getTime(),
          balancePaisa: chargeBalancePaisa(c),
        })),
        funds: [...advance, { source: NEW_PAYMENT, availablePaisa: newPaisa }],
        requested: new Map(
          selections.map((s) => [s.chargeId, toPaisa(s.amount ?? 0)]),
        ),
      });
    } catch (err) {
      if (err instanceof AllocationPlanError)
        throw billingError(err.code, err.message);
      throw err;
    }
  }

  /** Advance sources, oldest payment first (6.5 step 4). */
  private fundsFrom(payments: Payment[]): FundSource[] {
    return [...payments]
      .sort(
        (a, b) =>
          a.receivedAt.getTime() - b.receivedAt.getTime() ||
          a.id.localeCompare(b.id),
      )
      .map((p) => ({ source: p.id, availablePaisa: paymentAdvancePaisa(p) }))
      .filter((f) => f.availablePaisa > 0);
  }

  private async advanceSources(
    manager: EntityManager,
    tenant: TenantContext,
    patientId: string,
  ): Promise<FundSource[]> {
    const payments = await manager
      .getRepository(Payment)
      .createQueryBuilder('p')
      .where(
        'p.organization_id = :org AND p.location_id = :loc AND p.patient_id = :patientId',
        {
          org: tenant.organizationId,
          loc: tenant.locationId,
          patientId,
        },
      )
      .andWhere('p.amount - p.allocated_amount - p.refunded_amount > 0')
      .getMany();
    return this.fundsFrom(payments);
  }

  private async loadOpenCharges(
    manager: EntityManager,
    tenant: TenantContext,
    patientId: string,
    selections: Selection[],
  ): Promise<Charge[]> {
    const ids = selections.map((s) => s.chargeId);
    if (!ids.length) return [];
    const charges = await manager.getRepository(Charge).find({
      where: {
        id: In(ids),
        organizationId: tenant.organizationId,
        locationId: tenant.locationId,
      },
    });
    if (charges.length !== new Set(ids).size)
      throw billingError('BILLING_NOT_FOUND', 'Charge not found');
    const invoiceIds = charges
      .map((c) => c.invoiceId)
      .filter((x): x is string => !!x);
    const invoices = invoiceIds.length
      ? await manager.getRepository(Invoice).findBy({ id: In(invoiceIds) })
      : [];
    this.assertCollectable(patientId, charges, invoices);
    return charges;
  }

  private async invoiceNumbers(
    manager: EntityManager,
    charges: Array<Pick<Charge, 'invoiceId'>>,
  ): Promise<Map<string, string>> {
    const ids = [
      ...new Set(
        charges.map((c) => c.invoiceId).filter((x): x is string => !!x),
      ),
    ];
    if (!ids.length) return new Map();
    const rows = await manager.getRepository(Invoice).find({
      where: { id: In(ids) },
      select: { id: true, invoiceNumber: true },
    });
    return new Map(rows.map((r) => [r.id, r.invoiceNumber]));
  }

  private findByClientRequest(
    tenant: TenantContext,
    clientRequestId: string,
  ): Promise<Payment | null> {
    return this.dataSource.getRepository(Payment).findOne({
      where: { organizationId: tenant.organizationId, clientRequestId },
    });
  }

  /** Builds the response; for idempotent replays the allocations are re-read. */
  private async resultFor(
    tenant: TenantContext,
    payment: Payment | null,
    run: {
      plan: AllocationPlan;
      invoice: Invoice | null;
      manager: EntityManager;
      patientId: string;
      charges: Charge[];
    } | null,
  ): Promise<CollectResult> {
    const manager = run?.manager ?? this.dataSource.manager;
    const patientId = run?.patientId ?? (payment as Payment).patientId;
    const { today } = await this.clock.read(tenant.locationId);
    const summary = await PatientBillingQueries.summary(
      manager,
      tenant,
      patientId,
      today,
    );
    const paymentView = payment
      ? await this.paymentView(manager, tenant, payment)
      : null;

    if (!run) {
      const rows: Array<{
        charge_id: string;
        invoice_number: string;
        amount: string;
      }> = await manager.query(
        `SELECT pa.charge_id, i.invoice_number, pa.amount FROM payment_allocations pa
           JOIN invoices i ON i.id = pa.invoice_id
          WHERE pa.payment_id = $1 AND pa.reason = 'PAYMENT' ORDER BY pa.created_at`,
        [(payment as Payment).id],
      );
      return {
        payment: paymentView,
        invoiceId: null,
        invoiceNumber: null,
        allocations: rows.map((r) => ({
          chargeId: r.charge_id,
          invoiceNumber: r.invoice_number,
          source: 'NEW',
          amount: Number(r.amount),
        })),
        summary,
      };
    }
    const numbers = await this.invoiceNumbers(manager, run.charges);
    const invoiceOf = new Map(run.charges.map((c) => [c.id, c.invoiceId]));
    return {
      payment: paymentView,
      invoiceId: run.invoice?.id ?? null,
      invoiceNumber: run.invoice?.invoiceNumber ?? null,
      allocations: run.plan.lines.map((l) => ({
        chargeId: l.chargeId,
        invoiceNumber: numbers.get(invoiceOf.get(l.chargeId) ?? '') ?? null,
        source: l.source === NEW_PAYMENT ? 'NEW' : 'ADVANCE',
        amount: fromPaisa(l.amountPaisa),
      })),
      summary,
    };
  }

  private async paymentView(
    manager: EntityManager,
    tenant: TenantContext,
    p: Payment,
  ): Promise<PaymentResponse> {
    const patient = await BillingLookups.patient(manager, tenant, p.patientId);
    const names = await BillingLookups.userNames(manager, [p.receivedBy]);
    return toPaymentResponse(p, patient, names.get(p.receivedBy) ?? null);
  }
}
