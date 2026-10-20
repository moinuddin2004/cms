import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { invariant } from '../common/lab-billing-errors';
import { invoiceStatusFor } from '../common/lab-billing-math';
import { LabInvoiceStatus } from '../enums/lab-billing.enums';

const unique = (ids: Iterable<string | null | undefined>): string[] => [
  ...new Set([...ids].filter((x): x is string => !!x)),
];

/**
 * The only writer of cached money columns and invoice status (billing v2
 * 6.12 pattern). Every method recomputes from source rows with SQL SUM —
 * never increments — and asserts the invariants (lab ERD §10 inv. 4, 5); a
 * failure throws LAB_BILLING_INVARIANT_VIOLATION and rolls back. Raw
 * UPDATEs: reload entities afterwards.
 */
@Injectable()
export class LabBillingTotals {
  /**
   * Inv. 4: total = Σ lines; balance = total − credited − active
   * allocations ≥ 0. Void invoices keep their frozen totals.
   */
  async recomputeInvoices(
    m: EntityManager,
    ids: Iterable<string | null>,
  ): Promise<void> {
    const list = unique(ids);
    if (!list.length) return;
    const rows = await sqlRows<{
      id: string;
      status: LabInvoiceStatus;
      total_paisa: string;
      credited_paisa: string;
      paid_paisa: string;
      balance_paisa: string;
    }>(
      m,
      `WITH s AS (
         SELECT i.id,
                COALESCE((SELECT SUM(l.quantity * l.unit_price_paisa) FROM lab_invoice_lines l WHERE l.invoice_id = i.id), 0) AS gross,
                COALESCE((SELECT SUM(l.discount_paisa) FROM lab_invoice_lines l WHERE l.invoice_id = i.id), 0) AS disc,
                COALESCE((SELECT SUM(l.tax_paisa) FROM lab_invoice_lines l WHERE l.invoice_id = i.id), 0) AS tax,
                COALESCE((SELECT SUM(c.amount_paisa) FROM lab_credit_notes c WHERE c.invoice_id = i.id), 0) AS credited,
                COALESCE((SELECT SUM(a.amount_paisa) FROM lab_payment_allocations a
                           WHERE a.invoice_id = i.id AND a.reversed_at IS NULL), 0) AS paid
           FROM lab_invoices i
          WHERE i.id = ANY($1::uuid[]) AND i.status <> 'void'
       ), t AS (
         SELECT s.*, s.gross - s.disc + s.tax AS total,
                s.gross - s.disc + s.tax - s.credited - s.paid AS balance
           FROM s
       )
       UPDATE lab_invoices i
          SET subtotal_paisa = t.gross, discount_paisa = t.disc, tax_paisa = t.tax,
              total_paisa = t.total, credited_paisa = t.credited, paid_paisa = t.paid,
              balance_paisa = GREATEST(t.balance, 0),
              status = CASE
                WHEN i.status IN ('draft', 'void') THEN i.status
                WHEN t.balance <= 0 THEN 'paid'
                WHEN t.paid > 0 THEN 'partially_paid'
                ELSE 'issued' END
         FROM t
        WHERE i.id = t.id
      RETURNING i.id, i.status, t.total::text AS total_paisa, t.credited::text AS credited_paisa,
                t.paid::text AS paid_paisa, t.balance::text AS balance_paisa`,
      [list],
    );
    for (const r of rows) {
      const total = Number(r.total_paisa);
      const credited = Number(r.credited_paisa);
      const paid = Number(r.paid_paisa);
      const balance = Number(r.balance_paisa);
      invariant(credited <= total, `Invoice ${r.id}: credited above total`);
      invariant(balance >= 0, `Invoice ${r.id}: negative balance`);
      invariant(
        r.status ===
          invoiceStatusFor({
            status: r.status,
            paidPaisa: paid,
            balancePaisa: balance,
          }),
        `Invoice ${r.id}: status out of step`,
      );
    }
  }

  /** Inv. 5: Σ active allocations + refunds ≤ amount; a reversed payment holds nothing. */
  async recomputePayments(
    m: EntityManager,
    ids: Iterable<string | null>,
  ): Promise<void> {
    const list = unique(ids);
    if (!list.length) return;
    const rows = await sqlRows<{
      id: string;
      amount_paisa: string;
      allocated_paisa: string;
      refunded_paisa: string;
      status: string;
    }>(
      m,
      `UPDATE lab_payments p
          SET allocated_paisa = COALESCE((SELECT SUM(a.amount_paisa) FROM lab_payment_allocations a
                                           WHERE a.payment_id = p.id AND a.reversed_at IS NULL), 0),
              refunded_paisa = COALESCE((SELECT SUM(s.amount_paisa) FROM lab_refund_sources s
                                          WHERE s.payment_id = p.id), 0)
        WHERE p.id = ANY($1::uuid[])
      RETURNING p.id, p.amount_paisa, p.allocated_paisa, p.refunded_paisa, p.status`,
      [list],
    );
    for (const r of rows) {
      const amount = Number(r.amount_paisa);
      const used = Number(r.allocated_paisa) + Number(r.refunded_paisa);
      invariant(
        used <= Math.max(amount, 0),
        `Payment ${r.id}: allocations exceed the payment`,
      );
      invariant(
        r.status !== 'reversed' || used === 0,
        `Payment ${r.id}: a reversed payment still holds money`,
      );
    }
  }

  /** refunded = Σ refunds; status from released vs refunded. */
  async recomputeCreditNotes(
    m: EntityManager,
    ids: Iterable<string | null>,
  ): Promise<void> {
    const list = unique(ids);
    if (!list.length) return;
    const rows = await sqlRows<{
      id: string;
      released_paisa: string;
      refunded_paisa: string;
    }>(
      m,
      `UPDATE lab_credit_notes c
          SET refunded_paisa = x.refunded,
              status = CASE
                WHEN c.released_paisa = 0 THEN 'applied'
                WHEN x.refunded >= c.released_paisa THEN 'refunded'
                ELSE 'issued' END::text::lab_credit_notes_status_enum
         FROM (SELECT c2.id, COALESCE((SELECT SUM(r.amount_paisa) FROM lab_refunds r
                                        WHERE r.credit_note_id = c2.id), 0) AS refunded
                 FROM lab_credit_notes c2 WHERE c2.id = ANY($1::uuid[])) x
        WHERE c.id = x.id
      RETURNING c.id, c.released_paisa, c.refunded_paisa`,
      [list],
    );
    for (const r of rows) {
      invariant(
        Number(r.refunded_paisa) <= Number(r.released_paisa),
        `Credit note ${r.id}: refunded more than released`,
      );
    }
  }
}
