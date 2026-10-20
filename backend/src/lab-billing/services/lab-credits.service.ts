import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
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
import { CreditNoteDto, RefundDto } from '../dto/lab-billing.dto';
import {
  LabCreditNote,
  LabRefund,
  LabRefundSource,
} from '../entities/lab-credit.entity';
import { LabPaymentAllocation } from '../entities/lab-payment.entity';
import {
  AllocationReleaseReason,
  LAB_BILLING_ENTITY,
  LabCreditNoteStatus,
  LabInvoiceStatus,
} from '../enums/lab-billing.enums';
import { AllocationRef, LabBillingEvents } from '../events/lab-billing-events';
import { LAB_BILLING_SEQUENCES } from '../lab-billing.constants';
import { LabAllocations } from './lab-allocations.service';
import { advanceOf, LabBillingLocks } from './lab-billing-locks';
import { LabBillingTotals } from './lab-billing-totals.service';

const CREDITABLE = new Set([
  LabInvoiceStatus.ISSUED,
  LabInvoiceStatus.PARTIALLY_PAID,
  LabInvoiceStatus.PAID,
]);

/**
 * Credit notes and refunds (lab ERD §6a, §15 "Cancel: patient ko refund ya
 * credit note"). A credit note lowers an invoice; money already paid above
 * the new total goes back to the patient's advance (newest allocation
 * first). A refund pays advance out, optionally as a credit note's payout.
 */
@Injectable()
export class LabCreditsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: ClockService,
    private readonly sequences: NumberSequenceService,
    private readonly idempotency: IdempotencyService,
    private readonly audit: AuditService,
    private readonly totals: LabBillingTotals,
    private readonly allocations: LabAllocations,
    private readonly events: LabBillingEvents,
  ) {}

  async creditNote(
    c: ClinicCall,
    invoiceId: string,
    dto: CreditNoteDto,
    key: string,
  ): Promise<string> {
    const org = c.tenant.organizationId;
    const scope = 'lab_billing.credit_note';
    return this.dataSource.transaction(async (m) => {
      const hit = await this.idempotency.claim(
        m,
        org,
        scope,
        key,
        requestHash({
          invoiceId,
          amountPaisa: dto.amountPaisa,
          reason: dto.reason,
        }),
      );
      if (hit) return (hit.response as { id: string }).id;

      const [invoice] = await LabBillingLocks.invoices(m, org, [invoiceId]);
      if (!CREDITABLE.has(invoice.status))
        throw labBillingError(
          'LAB_BILLING_INVOICE_NOT_OPEN',
          'Only an issued invoice can be credited',
        );
      const creditable = invoice.totalPaisa - invoice.creditedPaisa;
      if (dto.amountPaisa > creditable)
        throw labBillingError(
          'LAB_BILLING_CREDIT_EXCEEDS_INVOICE',
          'More than is left on this invoice',
          { creditablePaisa: creditable },
        );

      // Paid above the new total → release, newest allocation first.
      const excess = Math.max(0, dto.amountPaisa - invoice.balancePaisa);
      const released: AllocationRef[] = [];
      const kept: AllocationRef[] = [];
      if (excess > 0) {
        const active = await m.getRepository(LabPaymentAllocation).find({
          where: { invoiceId, reversedAt: IsNull() },
          order: { createdAt: 'DESC', id: 'DESC' },
        });
        let left = excess;
        const picked: Array<{ a: LabPaymentAllocation; take: number }> = [];
        for (const a of active) {
          if (left === 0) break;
          const take = Math.min(left, a.amountPaisa);
          picked.push({ a, take });
          left -= take;
        }
        await LabBillingLocks.payments(
          m,
          org,
          picked.map((p) => p.a.paymentId),
        );
        await this.allocations.release(
          m,
          c,
          picked.map((p) => p.a.id),
          AllocationReleaseReason.CREDIT_NOTE,
        );
        for (const { a } of picked)
          released.push({
            allocationId: a.id,
            paymentId: a.paymentId,
            invoiceId,
            amountPaisa: a.amountPaisa,
          });
        // A row only partly needed stays allocated for the rest.
        kept.push(
          ...(await this.allocations.insert(
            m,
            c,
            picked
              .filter((p) => p.take < p.a.amountPaisa)
              .map((p) => ({
                paymentId: p.a.paymentId,
                invoiceId,
                amountPaisa: p.a.amountPaisa - p.take,
              })),
          )),
        );
      }

      const creditNoteNo = await this.sequences.next(
        m,
        org,
        LAB_BILLING_SEQUENCES.CREDIT_NOTE,
      );
      const repo = m.getRepository(LabCreditNote);
      const note = await repo.save(
        repo.create({
          organizationId: org,
          locationId: invoice.locationId,
          creditNoteNo,
          invoiceId,
          patientId: invoice.patientId,
          amountPaisa: dto.amountPaisa,
          reason: dto.reason.trim(),
          status:
            excess > 0
              ? LabCreditNoteStatus.ISSUED
              : LabCreditNoteStatus.APPLIED,
          releasedPaisa: excess,
          createdBy: c.actor.userId,
        }),
      );
      await this.totals.recomputeInvoices(m, [invoiceId]);
      await this.totals.recomputePayments(
        m,
        released.map((r) => r.paymentId),
      );
      await this.totals.recomputeCreditNotes(m, [note.id]);

      await this.audit.record(m, c.ref, {
        organizationId: org,
        entityType: LAB_BILLING_ENTITY.CREDIT_NOTE,
        entityId: note.id,
        action: AuditAction.CREATE,
        after: {
          creditNoteNo,
          invoiceId,
          amountPaisa: dto.amountPaisa,
          releasedPaisa: excess,
          reason: note.reason,
        },
      });
      await this.events.emit(m, 'creditNoteIssued', {
        organizationId: org,
        locationId: invoice.locationId,
        patientId: invoice.patientId,
        actorUserId: c.actor.userId,
        creditNoteId: note.id,
        creditNoteNo,
        invoiceId,
        amountPaisa: dto.amountPaisa,
        releasedAllocations: released,
        keptAllocations: kept,
      });
      await this.idempotency.complete(m, org, scope, key, { id: note.id });
      return note.id;
    });
  }

  /** Inv. 10 on the refund's own `idempotency_key`. */
  async refund(c: ClinicCall, dto: RefundDto, key: string): Promise<string> {
    const org = c.tenant.organizationId;
    const replay = await this.byKey(org, key, dto);
    if (replay) return replay;
    try {
      return await this.dataSource.transaction(async (m) => {
        const [patient] = await sqlRows<{ id: string }>(
          m,
          `SELECT id FROM patients WHERE id = $1 AND organization_id = $2`,
          [dto.patientId, org],
        );
        if (!patient) throw notFound('Patient');

        const note = dto.creditNoteId
          ? await LabBillingLocks.creditNote(m, org, dto.creditNoteId)
          : null;
        if (note) {
          if (note.patientId !== dto.patientId)
            throw labBillingError(
              'LAB_BILLING_INVALID',
              'The credit note is for another patient',
            );
          if (dto.amountPaisa > note.releasedPaisa - note.refundedPaisa)
            throw labBillingError(
              'LAB_BILLING_REFUND_EXCEEDS_CREDIT',
              'More than is left to pay out on this credit note',
              { refundablePaisa: note.releasedPaisa - note.refundedPaisa },
            );
        }
        const payments = await LabBillingLocks.advancePayments(
          m,
          org,
          dto.patientId,
        );
        const available = payments.reduce((s, p) => s + advanceOf(p), 0);
        if (dto.amountPaisa > available)
          throw labBillingError(
            'LAB_BILLING_REFUND_EXCEEDS_ADVANCE',
            'More than the patient’s advance',
            { advancePaisa: available },
          );
        const sources: Array<{ paymentId: string; amountPaisa: number }> = [];
        let left = dto.amountPaisa;
        for (const p of payments) {
          if (left === 0) break;
          const take = Math.min(left, advanceOf(p));
          if (take > 0) {
            sources.push({ paymentId: p.id, amountPaisa: take });
            left -= take;
          }
        }

        const refundNo = await this.sequences.next(
          m,
          org,
          LAB_BILLING_SEQUENCES.REFUND,
        );
        const repo = m.getRepository(LabRefund);
        const refund = await repo.save(
          repo.create({
            organizationId: org,
            locationId: c.tenant.locationId,
            refundNo,
            patientId: dto.patientId,
            creditNoteId: note?.id ?? null,
            amountPaisa: dto.amountPaisa,
            method: dto.method,
            reference: dto.reference?.trim() || null,
            reason: dto.reason.trim(),
            refundedAt: this.clock.now(),
            refundedBy: c.actor.userId,
            idempotencyKey: key,
          }),
        );
        const srcRepo = m.getRepository(LabRefundSource);
        await srcRepo.save(
          sources.map((s) =>
            srcRepo.create({ organizationId: org, refundId: refund.id, ...s }),
          ),
        );
        await this.totals.recomputePayments(
          m,
          sources.map((s) => s.paymentId),
        );
        await this.totals.recomputeCreditNotes(m, [note?.id ?? null]);

        await this.audit.record(m, c.ref, {
          organizationId: org,
          entityType: LAB_BILLING_ENTITY.REFUND,
          entityId: refund.id,
          action: AuditAction.CREATE,
          after: {
            refundNo,
            amountPaisa: refund.amountPaisa,
            method: refund.method,
            creditNoteId: refund.creditNoteId,
            reason: refund.reason,
          },
        });
        await this.events.emit(m, 'refundPaid', {
          organizationId: org,
          locationId: refund.locationId,
          patientId: refund.patientId,
          actorUserId: c.actor.userId,
          refundId: refund.id,
          refundNo,
          amountPaisa: refund.amountPaisa,
          method: refund.method,
          creditNoteId: refund.creditNoteId,
          sources,
        });
        return refund.id;
      });
    } catch (err) {
      if (pgError(err).constraint === 'uq_lab_refunds_org_idempotency') {
        const winner = await this.byKey(org, key, dto);
        if (winner) return winner;
      }
      throw err;
    }
  }

  private async byKey(
    org: string,
    key: string,
    dto: RefundDto,
  ): Promise<string | null> {
    const hit = await this.dataSource
      .getRepository(LabRefund)
      .findOneBy({ organizationId: org, idempotencyKey: key });
    if (!hit) return null;
    if (hit.patientId !== dto.patientId || hit.amountPaisa !== dto.amountPaisa)
      throw labBillingError(
        'IDEMPOTENCY_KEY_REUSED',
        'This Idempotency-Key was already used for a different refund',
      );
    return hit.id;
  }
}
