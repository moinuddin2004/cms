import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { toPaisa } from '../common/money';

export type InvariantId =
  | 'I1'
  | 'I2'
  | 'I3'
  | 'I4'
  | 'I5'
  | 'I6'
  | 'I7'
  | 'I8'
  | 'I9'
  | 'I10';

export interface InvariantViolation {
  invariant: InvariantId;
  message: string;
}

type Row = Record<string, string | null>;

/**
 * Read-only audit of the money invariants I1–I9 (plan 6.16) for one patient
 * (I6 covers the patient's whole location number series). Never writes;
 * returns the violations instead of throwing so tests and ops tooling can
 * report all of them at once. Raw SQL on purpose: it must not share code
 * with `BillingTotalsService`, whose output it verifies.
 */
@Injectable()
export class BillingInvariantChecker {
  async checkPatient(
    manager: EntityManager,
    tenant: TenantContext,
    patientId: string,
  ): Promise<InvariantViolation[]> {
    const args = [tenant.organizationId, tenant.locationId, patientId];
    const out: InvariantViolation[] = [];
    const add = (
      invariant: InvariantId,
      rows: Row[],
      text: (r: Row) => string,
    ) => rows.forEach((r) => out.push({ invariant, message: text(r) }));

    add(
      'I1',
      await manager.query(
        `SELECT c.id, c.allocated_amount, c.net_amount, c.tax_amount, c.status,
                COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.charge_id = c.id), 0) AS actual
           FROM charges c
          WHERE c.organization_id = $1 AND c.location_id = $2 AND c.patient_id = $3
            AND (c.allocated_amount <> COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.charge_id = c.id), 0)
              OR c.allocated_amount < 0
              OR c.allocated_amount > CASE WHEN c.status = 'VOID' THEN 0 ELSE c.net_amount + c.tax_amount END)`,
        args,
      ),
      (r) =>
        `charge ${r.id}: allocated ${r.allocated_amount} vs SUM ${r.actual}, net ${r.net_amount} + tax ${r.tax_amount}, ${r.status}`,
    );

    add(
      'I2',
      await manager.query(
        `SELECT p.id, p.amount, p.allocated_amount, p.refunded_amount,
                COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.payment_id = p.id), 0) AS alloc,
                COALESCE((SELECT SUM(rs.amount) FROM refund_sources rs WHERE rs.payment_id = p.id), 0) AS refunded
           FROM payments p
          WHERE p.organization_id = $1 AND p.location_id = $2 AND p.patient_id = $3
            AND (p.allocated_amount <> COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.payment_id = p.id), 0)
              OR p.refunded_amount <> COALESCE((SELECT SUM(rs.amount) FROM refund_sources rs WHERE rs.payment_id = p.id), 0)
              OR p.allocated_amount + p.refunded_amount > p.amount)`,
        args,
      ),
      (r) =>
        `payment ${r.id}: cached ${r.allocated_amount}/${r.refunded_amount} vs actual ${r.alloc}/${r.refunded}, amount ${r.amount}`,
    );

    add(
      'I3',
      await manager.query(
        `SELECT i.id, i.total_amount, i.paid_amount, i.balance_due, i.subtotal, i.discount_total,
                i.tax_amount, i.tax_rate, s.gross, s.disc, s.net, s.tax, s.alloc
           FROM invoices i
           JOIN LATERAL (
             SELECT COALESCE(SUM(c.gross_amount), 0) AS gross, COALESCE(SUM(c.discount_amount), 0) AS disc,
                    COALESCE(SUM(c.net_amount), 0) AS net, COALESCE(SUM(c.tax_amount), 0) AS tax,
                    COALESCE(SUM(c.allocated_amount), 0) AS alloc
               FROM charges c WHERE c.invoice_id = i.id AND c.status = 'ACTIVE') s ON TRUE
          WHERE i.organization_id = $1 AND i.location_id = $2 AND i.patient_id = $3
            AND i.status = 'ISSUED'
            AND (i.subtotal <> s.gross OR i.discount_total <> s.disc OR i.tax_amount <> s.tax
              OR i.total_amount <> s.net + s.tax
              OR i.tax_amount <> ROUND(s.net * i.tax_rate / 100, 2)
              OR i.paid_amount <> s.alloc OR i.balance_due <> s.net + s.tax - s.alloc)`,
        args,
      ),
      (r) =>
        `invoice ${r.id}: cached total ${r.total_amount} (tax ${r.tax_amount} @ ${r.tax_rate}%)/paid ${r.paid_amount} vs charges ${r.net} + ${r.tax}/${r.alloc}`,
    );

    add(
      'I4',
      await manager.query(
        `SELECT pa.charge_id AS id, 'allocation on a charge without an ISSUED invoice' AS why
           FROM payment_allocations pa
           JOIN charges c ON c.id = pa.charge_id
           LEFT JOIN invoices i ON i.id = c.invoice_id
          WHERE pa.organization_id = $1 AND pa.location_id = $2 AND pa.patient_id = $3
            AND (i.id IS NULL OR i.status <> 'ISSUED' OR pa.invoice_id <> c.invoice_id)
          GROUP BY pa.charge_id, i.id, c.invoice_id, i.status
          HAVING SUM(pa.amount) <> 0
         UNION ALL
         SELECT pa.charge_id, 'negative net allocation for payment ' || pa.payment_id
           FROM payment_allocations pa
          WHERE pa.organization_id = $1 AND pa.location_id = $2 AND pa.patient_id = $3
          GROUP BY pa.payment_id, pa.charge_id
          HAVING SUM(pa.amount) < 0`,
        args,
      ),
      (r) => `charge ${r.id}: ${r.why}`,
    );

    const [i5]: Row[] = await manager.query(
      `SELECT
         (SELECT COALESCE(SUM(l.debit - l.credit), 0) FROM ledger_entries l
           WHERE l.organization_id = $1 AND l.location_id = $2 AND l.patient_id = $3) AS ledger,
         (SELECT COALESCE(SUM(i.balance_due), 0) FROM invoices i
           WHERE i.organization_id = $1 AND i.location_id = $2 AND i.patient_id = $3
             AND i.status = 'ISSUED') AS outstanding,
         (SELECT COALESCE(SUM(p.amount - p.allocated_amount - p.refunded_amount), 0) FROM payments p
           WHERE p.organization_id = $1 AND p.location_id = $2 AND p.patient_id = $3) AS advance`,
      args,
    );
    if (
      toPaisa(i5.ledger as string) !==
      toPaisa(i5.outstanding as string) - toPaisa(i5.advance as string)
    ) {
      out.push({
        invariant: 'I5',
        message: `ledger ${i5.ledger} != outstanding ${i5.outstanding} - advance ${i5.advance}`,
      });
    }

    out.push(...(await this.checkNumbering(manager, tenant)));

    add(
      'I7',
      await manager.query(
        `SELECT r.id, r.amount, COALESCE(SUM(rs.amount), 0) AS sources
           FROM refunds r LEFT JOIN refund_sources rs ON rs.refund_id = r.id
          WHERE r.organization_id = $1 AND r.location_id = $2 AND r.patient_id = $3
          GROUP BY r.id, r.amount
         HAVING r.amount <> COALESCE(SUM(rs.amount), 0)`,
        args,
      ),
      (r) => `refund ${r.id}: amount ${r.amount} vs sources ${r.sources}`,
    );

    add(
      'I8',
      await manager.query(
        `SELECT 'allocation ' || pa.id AS id, 'differs from its charge/payment/invoice' AS why
           FROM payment_allocations pa
           JOIN charges c ON c.id = pa.charge_id
           JOIN payments p ON p.id = pa.payment_id
           JOIN invoices i ON i.id = pa.invoice_id
          WHERE pa.patient_id = $3 AND pa.organization_id = $1 AND pa.location_id = $2
            AND (c.organization_id <> pa.organization_id OR c.location_id <> pa.location_id OR c.patient_id <> pa.patient_id
              OR p.organization_id <> pa.organization_id OR p.location_id <> pa.location_id OR p.patient_id <> pa.patient_id
              OR i.organization_id <> pa.organization_id OR i.location_id <> pa.location_id OR i.patient_id <> pa.patient_id)
         UNION ALL
         SELECT 'charge ' || c.id, 'differs from its invoice'
           FROM charges c JOIN invoices i ON i.id = c.invoice_id
          WHERE c.patient_id = $3 AND c.organization_id = $1 AND c.location_id = $2
            AND (i.organization_id <> c.organization_id OR i.location_id <> c.location_id OR i.patient_id <> c.patient_id)
         UNION ALL
         SELECT 'refund ' || r.id, 'differs from its invoice/sources'
           FROM refunds r
           LEFT JOIN invoices i ON i.id = r.invoice_id
          WHERE r.patient_id = $3 AND r.organization_id = $1 AND r.location_id = $2
            AND ((i.id IS NOT NULL AND (i.organization_id <> r.organization_id OR i.location_id <> r.location_id OR i.patient_id <> r.patient_id))
              OR EXISTS (SELECT 1 FROM refund_sources rs JOIN payments p ON p.id = rs.payment_id
                          WHERE rs.refund_id = r.id
                            AND (p.organization_id <> r.organization_id OR p.location_id <> r.location_id OR p.patient_id <> r.patient_id)))
         UNION ALL
         SELECT 'ledger ' || l.id, 'differs from its invoice/payment/refund'
           FROM ledger_entries l
           LEFT JOIN invoices i ON i.id = l.invoice_id
           LEFT JOIN payments p ON p.id = l.payment_id
           LEFT JOIN refunds r ON r.id = l.refund_id
          WHERE l.patient_id = $3 AND l.organization_id = $1 AND l.location_id = $2
            AND ((i.id IS NOT NULL AND (i.organization_id <> l.organization_id OR i.location_id <> l.location_id OR i.patient_id <> l.patient_id))
              OR (p.id IS NOT NULL AND (p.organization_id <> l.organization_id OR p.location_id <> l.location_id OR p.patient_id <> l.patient_id))
              OR (r.id IS NOT NULL AND (r.organization_id <> l.organization_id OR r.location_id <> l.location_id OR r.patient_id <> l.patient_id)))`,
        args,
      ),
      (r) => `${r.id}: ${r.why}`,
    );

    add(
      'I9',
      await manager.query(
        `SELECT i.id, i.refunded_amount, i.released_amount,
                COALESCE((SELECT SUM(r.amount) FROM refunds r WHERE r.invoice_id = i.id), 0) AS refunds,
                COALESCE((SELECT -SUM(pa.amount) FROM payment_allocations pa
                           WHERE pa.invoice_id = i.id AND pa.amount < 0), 0) AS released
           FROM invoices i
          WHERE i.organization_id = $1 AND i.location_id = $2 AND i.patient_id = $3
            AND (i.refunded_amount <> COALESCE((SELECT SUM(r.amount) FROM refunds r WHERE r.invoice_id = i.id), 0)
              OR i.released_amount <> COALESCE((SELECT -SUM(pa.amount) FROM payment_allocations pa
                                                 WHERE pa.invoice_id = i.id AND pa.amount < 0), 0)
              OR i.refunded_amount < 0 OR i.refunded_amount > i.released_amount)`,
        args,
      ),
      (r) =>
        `invoice ${r.id}: refunded ${r.refunded_amount} (actual ${r.refunds}), released ${r.released_amount} (actual ${r.released})`,
    );

    add(
      'I10',
      await manager.query(this.commissionSql('c.patient_id = $3'), args),
      (r) =>
        `charge ${r.id}: commission entries ${r.recorded} vs target ${r.target} (collected ${r.collected})`,
    );

    return out;
  }

  /**
   * I10 for a whole location (the nightly job): every charge with a
   * commission snapshot has SUM(commission_entries) = its target.
   */
  async checkCommissions(
    manager: EntityManager,
    tenant: TenantContext,
  ): Promise<InvariantViolation[]> {
    const rows: Row[] = await manager.query(this.commissionSql('TRUE'), [
      tenant.organizationId,
      tenant.locationId,
    ]);
    return rows.map((r) => ({
      invariant: 'I10' as const,
      message: `charge ${r.id}: commission entries ${r.recorded} vs target ${r.target} (collected ${r.collected})`,
    }));
  }

  /**
   * Commission target in SQL numeric (exact decimals, ROUND = half away
   * from zero), deliberately not shared with `commission-math.ts`:
   * collected = pre-tax part of allocated (× net / (net + tax)), capped at
   * net; NET rate, GROSS rate or fixed share.
   */
  private commissionSql(patientFilter: string): string {
    return `
      WITH base AS (
        SELECT c.id,
               c.commission_rate_bps AS rate, c.commission_fixed_paisa AS fixed,
               p.commission_basis AS basis,
               c.gross_amount * 100 AS gross,
               CASE WHEN c.status = 'VOID' THEN 0 ELSE c.net_amount * 100 END AS net,
               CASE WHEN c.status = 'VOID' THEN 0 ELSE c.tax_amount * 100 END AS tax,
               COALESCE((SELECT SUM(pa.amount) * 100 FROM payment_allocations pa WHERE pa.charge_id = c.id), 0) AS alloc_all,
               COALESCE((SELECT SUM(ce.amount_paisa) FROM commission_entries ce WHERE ce.charge_id = c.id), 0) AS recorded
          FROM charges c
          JOIN compensation_plans p ON p.id = c.commission_plan_id
         WHERE c.organization_id = $1 AND c.location_id = $2 AND ${patientFilter}
           AND c.performing_assignment_id IS NOT NULL
           AND (c.commission_rate_bps IS NOT NULL OR c.commission_fixed_paisa IS NOT NULL)
      ), pre AS (
        SELECT *, CASE WHEN tax = 0 THEN alloc_all
                       ELSE ROUND(GREATEST(alloc_all, 0) * net / (net + tax)) END AS alloc
          FROM base
      ), t AS (
        SELECT id, recorded, LEAST(GREATEST(alloc, 0), net) AS collected,
               CASE
                 WHEN net = 0 THEN 0
                 WHEN fixed IS NOT NULL THEN ROUND(fixed * LEAST(GREATEST(alloc, 0), net) / net)
                 WHEN basis = 'GROSS' THEN ROUND(LEAST(GREATEST(alloc, 0), net) * gross * rate / (net * 10000))
                 ELSE ROUND(LEAST(GREATEST(alloc, 0), net) * rate / 10000.0)
               END AS target
          FROM pre
      )
      SELECT id, recorded, target, collected FROM t WHERE recorded <> target`;
  }

  /**
   * I6: per (docType, year) of the patient's location, the numbers are
   * unique, consecutive from 1, and the sequence counter equals the highest.
   * Receipts count payments only: "apply advance" issues no receipt.
   */
  private async checkNumbering(
    manager: EntityManager,
    tenant: TenantContext,
  ): Promise<InvariantViolation[]> {
    const rows: Row[] = await manager.query(
      `WITH nums AS (
         SELECT 'INVOICE' AS doc_type, invoice_number AS num FROM invoices
          WHERE organization_id = $1 AND location_id = $2
         UNION ALL
         SELECT 'RECEIPT', receipt_number FROM payments
          WHERE organization_id = $1 AND location_id = $2
         UNION ALL
         SELECT 'REFUND', refund_number FROM refunds
          WHERE organization_id = $1 AND location_id = $2
       ), parsed AS (
         SELECT doc_type, num,
                split_part(num, '-', 3)::int AS yr,
                split_part(num, '-', 4)::int AS seq
           FROM nums
       ), agg AS (
         SELECT doc_type, yr, COUNT(*) AS n, COUNT(DISTINCT seq) AS d, MAX(seq) AS mx, MIN(seq) AS mn
           FROM parsed GROUP BY doc_type, yr
       )
       SELECT a.doc_type, a.yr, a.n, a.d, a.mx, a.mn, ds.last_value
         FROM agg a
         LEFT JOIN document_sequences ds
           ON ds.organization_id = $1 AND ds.location_id = $2
          AND ds.doc_type::text = a.doc_type AND ds.year = a.yr
        WHERE a.n <> a.d OR a.mn <> 1 OR a.mx <> a.n OR ds.last_value IS DISTINCT FROM a.mx`,
      [tenant.organizationId, tenant.locationId],
    );
    return rows.map((r) => ({
      invariant: 'I6' as const,
      message: `${r.doc_type} ${r.yr}: ${r.n} numbers, ${r.d} distinct, range ${r.mn}..${r.mx}, counter ${r.last_value}`,
    }));
  }
}
