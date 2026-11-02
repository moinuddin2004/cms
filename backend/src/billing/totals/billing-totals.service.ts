import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { invariant } from '../common/billing-errors';
import { toMinor } from '../common/money';

const unique = (ids: Iterable<string | null | undefined>): string[] => [
  ...new Set([...ids].filter((x): x is string => !!x)),
];

/**
 * The only writer of cached money columns (6.12). Every method recomputes
 * from source rows with SQL SUM — never increments — and asserts the
 * invariants; a failure throws BILLING_INVARIANT_VIOLATION and rolls the
 * transaction back. Raw UPDATEs: reload entities afterwards.
 */
@Injectable()
export class BillingTotalsService {
  /** I1: allocated = SUM(allocations), 0 ≤ allocated ≤ net + tax, VOID → 0. */
  async recomputeCharges(
    manager: EntityManager,
    ids: Iterable<string>,
  ): Promise<void> {
    const list = unique(ids);
    if (!list.length) return;
    const rows = await sqlRows<{
      id: string;
      allocated_amount: string;
      net_amount: string;
      tax_amount: string;
      status: string;
    }>(
      manager,
      `UPDATE charges c
            SET allocated_amount = COALESCE(
              (SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.charge_id = c.id), 0)
          WHERE c.id = ANY($1::uuid[])
        RETURNING c.id, c.allocated_amount, c.net_amount, c.tax_amount, c.status`,
      [list],
    );
    for (const r of rows) {
      const allocated = toMinor(r.allocated_amount);
      const cap =
        r.status === 'VOID' ? 0 : toMinor(r.net_amount) + toMinor(r.tax_amount);
      invariant(
        allocated >= 0 && allocated <= cap,
        `Charge ${r.id}: allocated outside [0, net + tax]`,
      );
    }
  }

  /**
   * I3 + I9: totals over ACTIVE charges for ISSUED invoices (cancelled ones
   * stay frozen); released / refunded for every invoice. Tax = SUM of the
   * charges' tax shares; total = net + tax (exclusive tax).
   */
  async recomputeInvoices(
    manager: EntityManager,
    ids: Iterable<string | null>,
  ): Promise<void> {
    const list = unique(ids);
    if (!list.length) return;
    await manager.query(
      `UPDATE invoices i
          SET subtotal = s.gross, discount_total = s.disc, tax_amount = s.tax,
              total_amount = s.net + s.tax,
              paid_amount = s.alloc, balance_due = s.net + s.tax - s.alloc
         FROM (
           SELECT i2.id,
                  COALESCE(SUM(c.gross_amount) FILTER (WHERE c.status = 'ACTIVE'), 0) AS gross,
                  COALESCE(SUM(c.discount_amount) FILTER (WHERE c.status = 'ACTIVE'), 0) AS disc,
                  COALESCE(SUM(c.net_amount) FILTER (WHERE c.status = 'ACTIVE'), 0) AS net,
                  COALESCE(SUM(c.tax_amount) FILTER (WHERE c.status = 'ACTIVE'), 0) AS tax,
                  COALESCE(SUM(c.allocated_amount) FILTER (WHERE c.status = 'ACTIVE'), 0) AS alloc
             FROM invoices i2
             LEFT JOIN charges c ON c.invoice_id = i2.id
            WHERE i2.id = ANY($1::uuid[]) AND i2.status = 'ISSUED'
            GROUP BY i2.id
         ) s
        WHERE i.id = s.id`,
      [list],
    );
    const rows = await sqlRows<{
      id: string;
      released_amount: string;
      refunded_amount: string;
      balance_due: string;
    }>(
      manager,
      `UPDATE invoices i
            SET released_amount = COALESCE(
                  (SELECT -SUM(pa.amount) FROM payment_allocations pa
                    WHERE pa.invoice_id = i.id AND pa.amount < 0), 0),
                refunded_amount = COALESCE(
                  (SELECT SUM(r.amount) FROM refunds r WHERE r.invoice_id = i.id), 0)
          WHERE i.id = ANY($1::uuid[])
        RETURNING i.id, i.released_amount, i.refunded_amount, i.balance_due`,
      [list],
    );
    for (const r of rows) {
      const refunded = toMinor(r.refunded_amount);
      invariant(
        refunded >= 0 && refunded <= toMinor(r.released_amount),
        `Invoice ${r.id}: refunded exceeds released`,
      );
      invariant(
        toMinor(r.balance_due) >= 0,
        `Invoice ${r.id}: negative balance`,
      );
    }
  }

  /** I2: allocated + refunded ≤ amount, both ≥ 0. */
  async recomputePayments(
    manager: EntityManager,
    ids: Iterable<string>,
  ): Promise<void> {
    const list = unique(ids);
    if (!list.length) return;
    const rows = await sqlRows<{
      id: string;
      amount: string;
      allocated_amount: string;
      refunded_amount: string;
    }>(
      manager,
      `UPDATE payments p
            SET allocated_amount = COALESCE(
                  (SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.payment_id = p.id), 0),
                refunded_amount = COALESCE(
                  (SELECT SUM(rs.amount) FROM refund_sources rs WHERE rs.payment_id = p.id), 0)
          WHERE p.id = ANY($1::uuid[])
        RETURNING p.id, p.amount, p.allocated_amount, p.refunded_amount`,
      [list],
    );
    for (const r of rows) {
      const allocated = toMinor(r.allocated_amount);
      const refunded = toMinor(r.refunded_amount);
      invariant(
        allocated >= 0 &&
          refunded >= 0 &&
          allocated + refunded <= toMinor(r.amount),
        `Payment ${r.id}: allocated + refunded exceeds amount`,
      );
    }
  }
}
