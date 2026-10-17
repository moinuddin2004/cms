import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BillingContext } from '../common/billing-context';
import { billingError, invariant } from '../common/billing-errors';
import { fromPaisa, toPaisa } from '../common/money';
import { Charge } from '../entities/charge.entity';
import { PaymentAllocation } from '../entities/payment-allocation.entity';
import { AllocationReason } from '../enums/billing.enums';

export interface AllocationRow {
  paymentId: string;
  charge: Pick<Charge, 'id' | 'invoiceId' | 'patientId'>;
  /** Signed paisa, never 0. */
  amountPaisa: number;
  reason: AllocationReason;
  note?: string | null;
}

export interface NetAllocation {
  paymentId: string;
  chargeId: string;
  netPaisa: number;
}

/**
 * Inserts allocation rows (append-only, signed) and releases money back to
 * advance (D13). Never opens a transaction; callers recompute totals after.
 */
@Injectable()
export class AllocationWriterService {
  async insert(
    manager: EntityManager,
    ctx: BillingContext,
    rows: AllocationRow[],
  ): Promise<void> {
    const real = rows.filter((r) => r.amountPaisa !== 0);
    if (!real.length) return;
    for (const r of real) {
      // I4: every allocation points to a billed charge.
      invariant(
        !!r.charge.invoiceId,
        `Allocation on unbilled charge ${r.charge.id}`,
      );
    }
    await manager.getRepository(PaymentAllocation).insert(
      real.map((r) => ({
        organizationId: ctx.tenant.organizationId,
        locationId: ctx.tenant.locationId,
        patientId: r.charge.patientId,
        paymentId: r.paymentId,
        chargeId: r.charge.id,
        invoiceId: r.charge.invoiceId as string,
        amount: fromPaisa(r.amountPaisa),
        reason: r.reason,
        note: r.note ?? null,
        createdBy: ctx.actor.userId,
      })),
    );
  }

  /** Net allocation per (payment, charge), newest allocation first. */
  async netAllocations(
    manager: EntityManager,
    where: { chargeIds?: string[]; paymentId?: string },
  ): Promise<NetAllocation[]> {
    const rows: Array<{ payment_id: string; charge_id: string; net: string }> =
      await manager.query(
        `SELECT pa.payment_id, pa.charge_id, SUM(pa.amount) AS net
         FROM payment_allocations pa
        WHERE ($1::uuid[] IS NULL OR pa.charge_id = ANY($1::uuid[]))
          AND ($2::uuid IS NULL OR pa.payment_id = $2::uuid)
        GROUP BY pa.payment_id, pa.charge_id
       HAVING SUM(pa.amount) > 0
        ORDER BY MAX(pa.created_at) DESC, pa.payment_id DESC`,
        [where.chargeIds ?? null, where.paymentId ?? null],
      );
    return rows.map((r) => ({
      paymentId: r.payment_id,
      chargeId: r.charge_id,
      netPaisa: toPaisa(r.net),
    }));
  }

  /**
   * Releases `releasePaisa` from a charge, newest allocation first (6.7
   * step 4). Returns the payments whose advance grew.
   */
  async releaseFromCharge(
    manager: EntityManager,
    ctx: BillingContext,
    charge: Pick<Charge, 'id' | 'invoiceId' | 'patientId'>,
    releasePaisa: number,
    reason: AllocationReason,
    note: string,
  ): Promise<Array<{ paymentId: string; amountPaisa: number }>> {
    if (releasePaisa <= 0) return [];
    const nets = await this.netAllocations(manager, { chargeIds: [charge.id] });
    const released: Array<{ paymentId: string; amountPaisa: number }> = [];
    let left = releasePaisa;
    for (const n of nets) {
      if (left === 0) break;
      const take = Math.min(left, n.netPaisa);
      released.push({ paymentId: n.paymentId, amountPaisa: take });
      left -= take;
    }
    invariant(left === 0, `Charge ${charge.id}: release exceeds allocations`);
    await this.insert(
      manager,
      ctx,
      released.map((r) => ({
        paymentId: r.paymentId,
        charge,
        amountPaisa: -r.amountPaisa,
        reason,
        note,
      })),
    );
    return released;
  }

  /** Unapply (6.9): each line ≤ the payment's current net on that charge. */
  async releaseFromPayment(
    manager: EntityManager,
    ctx: BillingContext,
    paymentId: string,
    charges: Map<string, Charge>,
    lines: Array<{ chargeId: string; amountPaisa: number }> | null,
    note: string,
  ): Promise<number> {
    const nets = await this.netAllocations(manager, { paymentId });
    const netByCharge = new Map(nets.map((n) => [n.chargeId, n.netPaisa]));
    const wanted =
      lines ??
      nets.map((n) => ({ chargeId: n.chargeId, amountPaisa: n.netPaisa }));
    for (const l of wanted) {
      if (
        l.amountPaisa <= 0 ||
        l.amountPaisa > (netByCharge.get(l.chargeId) ?? 0)
      ) {
        throw billingError(
          'BILLING_UNAPPLY_EXCEEDS_ALLOCATION',
          'Cannot release more than was applied',
        );
      }
    }
    await this.insert(
      manager,
      ctx,
      wanted.map((l) => {
        const charge = charges.get(l.chargeId);
        invariant(!!charge, `Unapply: charge ${l.chargeId} not locked`);
        return {
          paymentId,
          charge: charge as Charge,
          amountPaisa: -l.amountPaisa,
          reason: AllocationReason.UNAPPLY,
          note,
        };
      }),
    );
    return wanted.reduce((a, l) => a + l.amountPaisa, 0);
  }
}
