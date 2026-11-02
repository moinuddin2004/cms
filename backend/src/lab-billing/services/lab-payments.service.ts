import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { AuditAction } from 'src/common/audit/audit.enums';
import { AuditService } from 'src/common/audit/audit.service';
import { ClockService } from 'src/common/clock/clock.service';
import { pgError, sqlRows } from 'src/common/database/sql';
import {
  IdempotencyService,
  requestHash,
} from 'src/common/idempotency/idempotency.service';
import { NumberSequenceService } from 'src/common/sequences/number-sequence.service';
import { ClinicCall } from 'src/lab-orders/common/order-context';
import { labBillingError, notFound } from '../common/lab-billing-errors';
import { fifoAllocations } from '../common/lab-billing-math';
import {
  ApplyAdvanceDto,
  CollectPaymentDto,
  ReasonDto,
} from '../dto/lab-billing.dto';
import {
  LabPayment,
  LabPaymentAllocation,
} from '../entities/lab-payment.entity';
import {
  AllocationReleaseReason,
  LAB_BILLING_ENTITY,
  LabPaymentStatus,
} from '../enums/lab-billing.enums';
import { AllocationRef, LabBillingEvents } from '../events/lab-billing-events';
import { LAB_BILLING_SEQUENCES } from '../lab-billing.constants';
import { LabPatientNotifier } from '../notifications/patient-notifier.service';
import {
  isOpen,
  LabAllocations,
  NewAllocation,
} from './lab-allocations.service';
import { LabBillingLocks } from './lab-billing-locks';
import { LabBillingTotals } from './lab-billing-totals.service';

/**
 * Patient payments for lab work (lab ERD §10 "Patient payment" + "Payment
 * reversal"): each one transaction — idempotency → locks (invoices →
 * payments) → receipt number → payment → allocations → cached totals →
 * audit → hooks (Sprint 10 ledger / commission) → outbox receipt.
 */
@Injectable()
export class LabPaymentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: ClockService,
    private readonly sequences: NumberSequenceService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
    private readonly totals: LabBillingTotals,
    private readonly allocations: LabAllocations,
    private readonly events: LabBillingEvents,
    private readonly notifier: LabPatientNotifier,
  ) {}

  /**
   * Inv. 10: the same key returns the same payment (and never a second
   * one). Inv. 5: allocations ≤ amount; each ≤ the invoice balance.
   */
  async collect(
    c: ClinicCall,
    dto: CollectPaymentDto,
    key: string,
  ): Promise<string> {
    const org = c.tenant.organizationId;
    const replay = await this.byKey(org, key, dto);
    if (replay) return replay;
    try {
      return await this.dataSource.transaction((m) =>
        this.runCollect(m, c, dto, key),
      );
    } catch (err) {
      // A parallel retry with the same key loses on the unique index.
      if (pgError(err).constraint === 'uq_lab_payments_org_idempotency') {
        const winner = await this.byKey(org, key, dto);
        if (winner) return winner;
      }
      throw err;
    }
  }

  private async runCollect(
    m: EntityManager,
    c: ClinicCall,
    dto: CollectPaymentDto,
    key: string,
  ): Promise<string> {
    const org = c.tenant.organizationId;
    await this.assertPatient(m, org, dto.patientId);

    // Lock the invoices first (lab ERD §10: SELECT … FOR UPDATE).
    let plan: NewAllocation[];
    if (dto.allocations?.length) {
      const invoices = await LabBillingLocks.invoices(
        m,
        org,
        dto.allocations.map((a) => a.invoiceId),
      );
      const byId = new Map(invoices.map((i) => [i.id, i]));
      if (byId.size !== dto.allocations.length)
        throw labBillingError(
          'LAB_BILLING_INVALID',
          'An invoice is listed twice',
        );
      for (const a of dto.allocations) {
        const inv = byId.get(a.invoiceId)!;
        if (inv.patientId !== dto.patientId)
          throw labBillingError(
            'LAB_BILLING_INVALID',
            'An invoice belongs to another patient',
          );
        if (!isOpen(inv))
          throw labBillingError(
            'LAB_BILLING_INVOICE_NOT_OPEN',
            `${inv.invoiceNo ?? 'The estimate'} is ${inv.status}`,
          );
        if (a.amountMinor > inv.balanceMinor)
          throw labBillingError(
            'LAB_BILLING_ALLOCATION_EXCEEDS_BALANCE',
            `More than the balance of ${inv.invoiceNo}`,
            { invoiceId: inv.id, balanceMinor: inv.balanceMinor },
          );
      }
      const sum = dto.allocations.reduce((s, a) => s + a.amountMinor, 0);
      if (sum > dto.amountMinor)
        throw labBillingError(
          'LAB_BILLING_ALLOCATION_EXCEEDS_PAYMENT',
          'The allocations add up to more than the payment',
        );
      plan = dto.allocations.map((a) => ({ paymentId: '', ...a }));
    } else if (dto.autoAllocate === false) {
      plan = [];
    } else {
      const open = await LabBillingLocks.openInvoices(m, org, dto.patientId);
      plan = fifoAllocations(
        open.map((i) => ({ id: i.id, balanceMinor: i.balanceMinor })),
        dto.amountMinor,
      ).map((a) => ({ paymentId: '', ...a }));
    }

    const tz = await this.clock.timezoneFor(c.tenant.locationId);
    const now = this.clock.now();
    const receiptNo = await this.sequences.next(
      m,
      org,
      LAB_BILLING_SEQUENCES.RECEIPT,
    );
    const repo = m.getRepository(LabPayment);
    const payment = await repo.save(
      repo.create({
        organizationId: org,
        locationId: c.tenant.locationId,
        receiptNo,
        patientId: dto.patientId,
        amountMinor: dto.amountMinor,
        method: dto.method,
        reference: dto.reference?.trim() || null,
        notes: dto.notes?.trim() || null,
        receivedAt: now,
        receivedOn: this.clock.today(tz, now),
        receivedBy: c.actor.userId,
        status: LabPaymentStatus.POSTED,
        idempotencyKey: key,
      }),
    );
    const refs = await this.allocations.insert(
      m,
      c,
      plan.map((a) => ({ ...a, paymentId: payment.id })),
    );
    await this.totals.recomputeInvoices(
      m,
      plan.map((a) => a.invoiceId),
    );
    await this.totals.recomputePayments(m, [payment.id]);

    await this.audit.record(m, c.ref, {
      organizationId: org,
      entityType: LAB_BILLING_ENTITY.PAYMENT,
      entityId: payment.id,
      action: AuditAction.CREATE,
      after: {
        receiptNo,
        amountMinor: payment.amountMinor,
        method: payment.method,
        allocations: refs.map((r) => `${r.invoiceId}:${r.amountMinor}`),
      },
    });
    await this.events.emit(m, 'paymentCollected', {
      organizationId: org,
      locationId: payment.locationId,
      patientId: payment.patientId,
      actorUserId: c.actor.userId,
      paymentId: payment.id,
      receiptNo,
      receivedOn: payment.receivedOn,
      amountMinor: payment.amountMinor,
      method: payment.method,
      allocations: refs,
    });
    await this.notifier.receipt(m, {
      organizationId: org,
      locationId: payment.locationId,
      patientId: payment.patientId,
      paymentId: payment.id,
      receiptNo,
      amountMinor: payment.amountMinor,
    });
    return payment.id;
  }

  /** Puts existing advance on an invoice (no new money, no receipt). */
  async applyAdvance(
    c: ClinicCall,
    invoiceId: string,
    dto: ApplyAdvanceDto,
    key: string,
  ): Promise<AllocationRef[]> {
    const org = c.tenant.organizationId;
    return this.dataSource.transaction(async (m) => {
      const hit = await this.idempotency.claim(
        m,
        org,
        'lab_billing.apply_advance',
        key,
        requestHash({ invoiceId, amountMinor: dto.amountMinor ?? null }),
      );
      if (hit) return hit.response as AllocationRef[];
      const [invoice] = await LabBillingLocks.invoices(m, org, [invoiceId]);
      if (!isOpen(invoice) || invoice.balanceMinor <= 0)
        throw labBillingError(
          'LAB_BILLING_INVOICE_NOT_OPEN',
          'Nothing is owed on this invoice',
        );
      const refs = await this.allocations.applyAdvance(
        m,
        c,
        invoice,
        dto.amountMinor,
      );
      if (!refs.length)
        throw labBillingError(
          'LAB_BILLING_NOTHING_TO_APPLY',
          'The patient has no advance',
        );
      await this.audit.record(m, c.ref, {
        organizationId: org,
        entityType: LAB_BILLING_ENTITY.INVOICE,
        entityId: invoiceId,
        action: AuditAction.UPDATE,
        after: {
          advanceApplied: refs.map((r) => `${r.paymentId}:${r.amountMinor}`),
        },
      });
      await this.events.emit(m, 'advanceApplied', {
        organizationId: org,
        locationId: invoice.locationId,
        patientId: invoice.patientId,
        actorUserId: c.actor.userId,
        allocations: refs,
      });
      await this.idempotency.complete(
        m,
        org,
        'lab_billing.apply_advance',
        key,
        refs,
      );
      return refs;
    });
  }

  /**
   * Lab ERD §10 "Payment reversal": original → `reversed`; a mirror row
   * (negative amount, `reversal_of_id`); its allocations get `reversed_at`;
   * invoice balances recomputed. Refused once any of it was refunded.
   * Returns the reversal row's id; the same key replays it.
   */
  async reverse(
    c: ClinicCall,
    paymentId: string,
    dto: ReasonDto,
    key: string,
  ): Promise<string> {
    const org = c.tenant.organizationId;
    const replay = await this.dataSource.getRepository(LabPayment).findOneBy({
      organizationId: org,
      idempotencyKey: key,
    });
    if (replay) {
      if (replay.reversalOfId !== paymentId)
        throw labBillingError(
          'IDEMPOTENCY_KEY_REUSED',
          'This Idempotency-Key was used for another request',
        );
      return replay.id;
    }
    try {
      return await this.dataSource.transaction((m) =>
        this.runReverse(m, c, paymentId, dto, key),
      );
    } catch (err) {
      if (pgError(err).constraint === 'uq_lab_payments_org_idempotency') {
        const winner = await this.dataSource
          .getRepository(LabPayment)
          .findOneBy({ organizationId: org, idempotencyKey: key });
        if (winner) return winner.id;
      }
      throw err;
    }
  }

  private async runReverse(
    m: EntityManager,
    c: ClinicCall,
    paymentId: string,
    dto: ReasonDto,
    key: string,
  ): Promise<string> {
    const org = c.tenant.organizationId;
    // Lock order invoices → payments: read the invoice ids, lock them, then the payment.
    const touched = await sqlRows<{ invoice_id: string }>(
      m,
      `SELECT DISTINCT a.invoice_id FROM lab_payment_allocations a
         JOIN lab_payments p ON p.id = a.payment_id
        WHERE a.payment_id = $1 AND p.organization_id = $2 AND a.reversed_at IS NULL`,
      [paymentId, org],
    );
    await LabBillingLocks.invoices(
      m,
      org,
      touched.map((t) => t.invoice_id),
    );
    const [payment] = await LabBillingLocks.payments(m, org, [paymentId]);
    if (payment.reversalOfId)
      throw labBillingError(
        'LAB_BILLING_INVALID',
        'A reversal cannot be reversed',
      );
    if (payment.status === LabPaymentStatus.REVERSED)
      throw labBillingError(
        'LAB_BILLING_PAYMENT_REVERSED',
        'This payment is already reversed',
      );
    if (payment.refundedMinor > 0)
      throw labBillingError(
        'LAB_BILLING_PAYMENT_REFUNDED',
        'Part of this payment was refunded — it can no longer be reversed',
      );

    const active = await m.getRepository(LabPaymentAllocation).find({
      where: { paymentId, reversedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    const locked = new Set(touched.map((t) => t.invoice_id));
    if (active.some((a) => !locked.has(a.invoiceId)))
      throw labBillingError(
        'LAB_BILLING_VERSION_CONFLICT',
        'This payment changed while reversing — try again',
      );
    await this.allocations.release(
      m,
      c,
      active.map((a) => a.id),
      AllocationReleaseReason.PAYMENT_REVERSED,
    );
    await m.getRepository(LabPayment).update(paymentId, {
      status: LabPaymentStatus.REVERSED,
    });

    const tz = await this.clock.timezoneFor(c.tenant.locationId);
    const now = this.clock.now();
    const receiptNo = await this.sequences.next(
      m,
      org,
      LAB_BILLING_SEQUENCES.REVERSAL,
    );
    const repo = m.getRepository(LabPayment);
    const mirror = await repo.save(
      repo.create({
        organizationId: org,
        locationId: c.tenant.locationId,
        receiptNo,
        patientId: payment.patientId,
        amountMinor: -payment.amountMinor,
        method: payment.method,
        reference: payment.reference,
        receivedAt: now,
        receivedOn: this.clock.today(tz, now),
        receivedBy: c.actor.userId,
        status: LabPaymentStatus.POSTED,
        reversalOfId: payment.id,
        reason: dto.reason.trim(),
        idempotencyKey: key,
      }),
    );
    await this.totals.recomputeInvoices(
      m,
      active.map((a) => a.invoiceId),
    );
    await this.totals.recomputePayments(m, [payment.id, mirror.id]);

    await this.audit.recordStatus(m, c.ref, {
      organizationId: org,
      entityType: LAB_BILLING_ENTITY.PAYMENT,
      entityId: payment.id,
      fromState: LabPaymentStatus.POSTED,
      toState: LabPaymentStatus.REVERSED,
      actionCode: 'reverse',
      reason: dto.reason.trim(),
      metadata: { reversalPaymentId: mirror.id, receiptNo },
    });
    await this.events.emit(m, 'paymentReversed', {
      organizationId: org,
      locationId: mirror.locationId,
      patientId: payment.patientId,
      actorUserId: c.actor.userId,
      paymentId: payment.id,
      reversalPaymentId: mirror.id,
      receiptNo,
      amountMinor: payment.amountMinor,
      method: payment.method,
      releasedAllocations: active.map((a) => ({
        allocationId: a.id,
        paymentId: a.paymentId,
        invoiceId: a.invoiceId,
        amountMinor: a.amountMinor,
      })),
    });
    return mirror.id;
  }

  /** Replay for a key: same payment, or 422 when the key came with another body. */
  private async byKey(
    org: string,
    key: string,
    dto: CollectPaymentDto,
  ): Promise<string | null> {
    const hit = await this.dataSource
      .getRepository(LabPayment)
      .findOneBy({ organizationId: org, idempotencyKey: key });
    if (!hit) return null;
    if (
      hit.reversalOfId ||
      hit.patientId !== dto.patientId ||
      hit.amountMinor !== dto.amountMinor
    )
      throw labBillingError(
        'IDEMPOTENCY_KEY_REUSED',
        'This Idempotency-Key was already used for a different payment',
      );
    return hit.id;
  }

  private async assertPatient(m: EntityManager, org: string, id: string) {
    const [p] = await sqlRows<{ id: string }>(
      m,
      `SELECT id FROM patients WHERE id = $1 AND organization_id = $2`,
      [id, org],
    );
    if (!p) throw notFound('Patient');
  }
}
