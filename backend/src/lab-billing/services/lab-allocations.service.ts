import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ClinicCall } from 'src/lab-orders/common/order-context';
import { invariant } from '../common/lab-billing-errors';
import { LabInvoice } from '../entities/lab-invoice.entity';
import { LabPaymentAllocation } from '../entities/lab-payment.entity';
import {
  AllocationReleaseReason,
  LabInvoiceStatus,
} from '../enums/lab-billing.enums';
import { AllocationRef } from '../events/lab-billing-events';
import { LabBillingTotals } from './lab-billing-totals.service';
import { advanceOf, LabBillingLocks } from './lab-billing-locks';

export interface NewAllocation {
  paymentId: string;
  invoiceId: string;
  amountPaisa: number;
}

const OPEN = new Set([
  LabInvoiceStatus.ISSUED,
  LabInvoiceStatus.PARTIALLY_PAID,
]);
export const isOpen = (i: Pick<LabInvoice, 'status'>): boolean =>
  OPEN.has(i.status);

/**
 * Writes allocation rows. Rows are only inserted, or stopped with
 * `reversed_at` — never edited otherwise or deleted. Never opens a
 * transaction; callers hold the invoice + payment locks.
 */
@Injectable()
export class LabAllocations {
  constructor(private readonly totals: LabBillingTotals) {}

  async insert(
    m: EntityManager,
    c: ClinicCall,
    rows: NewAllocation[],
  ): Promise<AllocationRef[]> {
    const real = rows.filter((r) => r.amountPaisa > 0);
    if (!real.length) return [];
    const repo = m.getRepository(LabPaymentAllocation);
    const saved = await repo.save(
      real.map((r) =>
        repo.create({
          organizationId: c.tenant.organizationId,
          paymentId: r.paymentId,
          invoiceId: r.invoiceId,
          amountPaisa: r.amountPaisa,
          createdBy: c.actor.userId,
        }),
      ),
    );
    return saved.map((a) => ({
      allocationId: a.id,
      paymentId: a.paymentId,
      invoiceId: a.invoiceId,
      amountPaisa: a.amountPaisa,
    }));
  }

  /** Stops allocations counting (reversal / credit note). */
  async release(
    m: EntityManager,
    c: ClinicCall,
    ids: string[],
    reason: AllocationReleaseReason,
  ): Promise<void> {
    if (!ids.length) return;
    const res = await m
      .createQueryBuilder()
      .update(LabPaymentAllocation)
      .set({
        reversedAt: () => 'now()',
        reversedBy: c.actor.userId,
        releaseReason: reason,
      })
      .where({ id: In(ids) })
      .andWhere('reversed_at IS NULL')
      .execute();
    invariant(res.affected === ids.length, 'Allocation already released');
  }

  /**
   * Uses the patient's advance (oldest payment first) on a locked, open
   * invoice — at most `maxPaisa`. Locks the advance payments (after the
   * invoice: lock order) and recomputes totals.
   */
  async applyAdvance(
    m: EntityManager,
    c: ClinicCall,
    invoice: LabInvoice,
    maxPaisa?: number,
  ): Promise<AllocationRef[]> {
    if (!isOpen(invoice) || invoice.balancePaisa <= 0) return [];
    const payments = await LabBillingLocks.advancePayments(
      m,
      invoice.organizationId,
      invoice.patientId,
    );
    let left = Math.min(invoice.balancePaisa, maxPaisa ?? Infinity);
    const rows: NewAllocation[] = [];
    for (const p of payments) {
      if (left <= 0) break;
      const take = Math.min(left, advanceOf(p));
      if (take > 0) {
        rows.push({
          paymentId: p.id,
          invoiceId: invoice.id,
          amountPaisa: take,
        });
        left -= take;
      }
    }
    const refs = await this.insert(m, c, rows);
    await this.totals.recomputeInvoices(m, [invoice.id]);
    await this.totals.recomputePayments(
      m,
      rows.map((r) => r.paymentId),
    );
    return refs;
  }
}
