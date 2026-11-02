import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { preTaxAllocationSql } from 'src/billing/tax/invoice-tax';
import { percentOfTotal } from '../core/report-format';
import type {
  ReportDefinition,
  ReportParams,
  ReportRow,
  ReportScope,
} from '../core/report.types';
import { LAB_INVOICE_LIVE } from '../finance/finance-data.service';

/** $1 org, $2 locations, $3 from, $4 to — the args every register starts with. */
const base = (s: ReportScope, p: ReportParams) => [
  s.organizationId,
  s.locationIds,
  p.from,
  p.to,
];

/** Drops the sort-only `at` column of a UNION register. */
function dropAt(rows: ReportRow[]): ReportRow[] {
  return rows.map((r) => {
    const out = { ...r };
    delete out.at;
    return out;
  });
}

/** Lab payment methods as people say them ("bank_transfer" → "Bank Transfer"). */
const LAB_METHOD = `initcap(replace(lp.method::text, '_', ' '))`;

export function revenueReports(db: DataSource): ReportDefinition[] {
  return [
    {
      key: 'collections',
      title: 'Payments received',
      description: 'Every receipt — clinic and lab — with patient and account.',
      category: 'revenue',
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'date', header: 'Date', type: 'date' },
        { key: 'receipt', header: 'Receipt #', type: 'text', weight: 1.3 },
        { key: 'source', header: 'For', type: 'text', weight: 0.8 },
        { key: 'patient', header: 'Patient', type: 'text', weight: 2.2 },
        { key: 'patientNo', header: 'MR #', type: 'text', weight: 1 },
        { key: 'account', header: 'Account', type: 'text', weight: 1.4 },
        { key: 'location', header: 'Location', type: 'text', weight: 1.3 },
        { key: 'amount', header: 'Amount', type: 'money', total: true },
        { key: 'advance', header: 'Unapplied', type: 'money', total: true },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `SELECT * FROM (
             SELECT p.payment_date::text AS date, p.receipt_number AS receipt, 'Clinic' AS source,
                    pt.full_name AS patient, pt.patient_number AS "patientNo",
                    p.payment_account_name AS account, l.name AS location,
                    (p.amount * 100)::bigint AS amount,
                    ((p.amount - p.allocated_amount - p.refunded_amount) * 100)::bigint AS advance,
                    p.received_at AS at
               FROM payments p
               JOIN patients pt ON pt.id = p.patient_id
               JOIN locations l ON l.id = p.location_id
              WHERE p.organization_id = $1 AND p.location_id = ANY($2)
                AND p.payment_date BETWEEN $3 AND $4
             UNION ALL
             SELECT lp.received_on::text, lp.receipt_no, 'Lab', pt.full_name, pt.patient_number,
                    ${LAB_METHOD}, l.name, lp.amount_minor,
                    GREATEST(lp.amount_minor - lp.allocated_minor - lp.refunded_minor, 0),
                    lp.received_at
               FROM lab_payments lp
               JOIN patients pt ON pt.id = lp.patient_id
               JOIN locations l ON l.id = lp.location_id
              WHERE lp.organization_id = $1 AND lp.location_id = ANY($2)
                AND lp.received_on BETWEEN $3 AND $4
           ) x ORDER BY date DESC, at DESC LIMIT $5`,
          [...base(s, p), p.limit],
        );
        return { rows: dropAt(rows) };
      },
    },
    {
      key: 'collections-by-account',
      title: 'Collections by account',
      description:
        'Cash, bank and wallet totals — what should be in each account.',
      category: 'revenue',
      filters: { dates: 'range' },
      columns: [
        { key: 'account', header: 'Account', type: 'text', weight: 2 },
        { key: 'receipts', header: 'Receipts', type: 'number', total: true },
        { key: 'received', header: 'Received', type: 'money', total: true },
        { key: 'refunded', header: 'Refunded', type: 'money', total: true },
        { key: 'net', header: 'Net', type: 'money', total: true },
        { key: 'share', header: 'Share', type: 'percent' },
      ],
      async run(s, p) {
        const rows = await sqlRows<{
          account: string;
          receipts: string;
          received: string;
          refunded: string;
        }>(
          db,
          `SELECT account, SUM(receipts)::int AS receipts, SUM(received)::bigint AS received,
                  SUM(refunded)::bigint AS refunded
             FROM (
               SELECT payment_account_name AS account, COUNT(*) AS receipts,
                      (SUM(amount) * 100)::bigint AS received, 0::bigint AS refunded
                 FROM payments
                WHERE organization_id = $1 AND location_id = ANY($2) AND payment_date BETWEEN $3 AND $4
                GROUP BY 1
               UNION ALL
               SELECT payment_account_name, 0, 0, (SUM(amount) * 100)::bigint
                 FROM refunds
                WHERE organization_id = $1 AND location_id = ANY($2) AND refund_date BETWEEN $3 AND $4
                GROUP BY 1
               UNION ALL
               SELECT 'Lab · ' || ${LAB_METHOD}, COUNT(*) FILTER (WHERE lp.amount_minor > 0),
                      SUM(lp.amount_minor), 0
                 FROM lab_payments lp
                WHERE lp.organization_id = $1 AND lp.location_id = ANY($2)
                  AND lp.received_on BETWEEN $3 AND $4
                GROUP BY 1
               UNION ALL
               SELECT 'Lab · ' || initcap(replace(lr.method::text, '_', ' ')), 0, 0, SUM(lr.amount_minor)
                 FROM lab_refunds lr
                WHERE lr.organization_id = $1 AND lr.location_id = ANY($2)
                  AND lr.refunded_at >= $5 AND lr.refunded_at < $6
                GROUP BY 1
             ) x
            GROUP BY account
            ORDER BY 3 DESC`,
          [...base(s, p), p.start, p.end],
        );
        const mapped = rows.map((x) => {
          const received = Number(x.received);
          const refunded = Number(x.refunded);
          return {
            account: x.account,
            receipts: Number(x.receipts),
            received,
            refunded,
            net: received - refunded,
          };
        });
        const totalNet = mapped.reduce((a, x) => a + x.net, 0);
        return {
          rows: mapped.map((x) => ({
            ...x,
            share: percentOfTotal(x.net, totalNet),
          })),
        };
      },
    },
    {
      key: 'invoices',
      title: 'Invoice register',
      description: 'Issued invoices (clinic and lab) with paid and balance.',
      category: 'revenue',
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'date', header: 'Date', type: 'date' },
        { key: 'invoice', header: 'Invoice #', type: 'text', weight: 1.3 },
        { key: 'source', header: 'For', type: 'text', weight: 0.7 },
        { key: 'patient', header: 'Patient', type: 'text', weight: 2.2 },
        { key: 'subtotal', header: 'Gross', type: 'money', total: true },
        { key: 'discount', header: 'Discount', type: 'money', total: true },
        { key: 'tax', header: 'Tax', type: 'money', total: true },
        { key: 'total', header: 'Total', type: 'money', total: true },
        { key: 'paid', header: 'Paid', type: 'money', total: true },
        { key: 'balance', header: 'Balance', type: 'money', total: true },
        { key: 'status', header: 'Status', type: 'text', weight: 1.1 },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `SELECT * FROM (
             SELECT i.issue_date::text AS date, i.invoice_number AS invoice, 'Clinic' AS source,
                    pt.full_name AS patient,
                    (i.subtotal * 100)::bigint AS subtotal, (i.discount_total * 100)::bigint AS discount,
                    (i.tax_amount * 100)::bigint AS tax, (i.total_amount * 100)::bigint AS total, (i.paid_amount * 100)::bigint AS paid,
                    (i.balance_due * 100)::bigint AS balance,
                    CASE WHEN i.balance_due <= 0 THEN 'Paid'
                         WHEN i.due_date < $5::date THEN 'Overdue'
                         WHEN i.paid_amount > 0 THEN 'Partly paid'
                         ELSE 'Unpaid' END AS status,
                    i.issued_at AS at
               FROM invoices i JOIN patients pt ON pt.id = i.patient_id
              WHERE i.organization_id = $1 AND i.location_id = ANY($2) AND i.status = 'ISSUED'
                AND i.issue_date BETWEEN $3 AND $4
             UNION ALL
             SELECT li.issued_on::text, li.invoice_no, 'Lab', pt.full_name,
                    li.subtotal_minor, li.discount_minor + li.credited_minor, li.tax_minor,
                    li.total_minor - li.credited_minor, li.paid_minor, li.balance_minor,
                    CASE WHEN li.balance_minor <= 0 THEN 'Paid'
                         WHEN COALESCE(li.due_on, li.issued_on) < $5::date THEN 'Overdue'
                         WHEN li.paid_minor > 0 THEN 'Partly paid'
                         ELSE 'Unpaid' END,
                    li.issued_at
               FROM lab_invoices li JOIN patients pt ON pt.id = li.patient_id
              WHERE li.organization_id = $1 AND li.location_id = ANY($2)
                AND li.status IN ${LAB_INVOICE_LIVE} AND li.issued_on BETWEEN $3 AND $4
           ) x ORDER BY date DESC, at DESC LIMIT $6`,
          [...base(s, p), s.today, p.limit],
        );
        return {
          rows: dropAt(rows),
          notes: [
            'Cancelled and voided invoices are left out. Lab credit notes count as discount.',
          ],
        };
      },
    },
    {
      key: 'outstanding',
      title: 'Outstanding balances',
      description: 'Who owes money, aged by due date — follow up from the top.',
      category: 'revenue',
      filters: { dates: 'asOf' },
      landscape: true,
      columns: [
        { key: 'patient', header: 'Patient', type: 'text', weight: 2.2 },
        { key: 'patientNo', header: 'MR #', type: 'text', weight: 1 },
        { key: 'phone', header: 'Phone', type: 'text', weight: 1.3 },
        {
          key: 'invoices',
          header: 'Invoices',
          type: 'number',
          total: true,
          weight: 0.8,
        },
        { key: 'current', header: 'Not due', type: 'money', total: true },
        { key: 'd30', header: '1–30 d', type: 'money', total: true },
        { key: 'd60', header: '31–60 d', type: 'money', total: true },
        { key: 'd90', header: '61–90 d', type: 'money', total: true },
        { key: 'd90plus', header: '90+ d', type: 'money', total: true },
        { key: 'total', header: 'Total due', type: 'money', total: true },
        { key: 'oldestDue', header: 'Oldest due', type: 'date' },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `WITH open AS (
             SELECT patient_id, (balance_due * 100)::bigint AS bal, due_date AS due
               FROM invoices
              WHERE organization_id = $1 AND location_id = ANY($2) AND status = 'ISSUED' AND balance_due > 0
             UNION ALL
             SELECT patient_id, balance_minor, COALESCE(due_on, issued_on)
               FROM lab_invoices
              WHERE organization_id = $1 AND location_id = ANY($2) AND status IN ${LAB_INVOICE_LIVE}
                AND balance_minor > 0)
           SELECT pt.full_name AS patient, pt.patient_number AS "patientNo", pt.phone,
                  COUNT(*)::int AS invoices,
                  COALESCE(SUM(bal) FILTER (WHERE due >= $3::date), 0) AS current,
                  COALESCE(SUM(bal) FILTER (WHERE $3::date - due BETWEEN 1 AND 30), 0) AS d30,
                  COALESCE(SUM(bal) FILTER (WHERE $3::date - due BETWEEN 31 AND 60), 0) AS d60,
                  COALESCE(SUM(bal) FILTER (WHERE $3::date - due BETWEEN 61 AND 90), 0) AS d90,
                  COALESCE(SUM(bal) FILTER (WHERE $3::date - due > 90), 0) AS d90plus,
                  SUM(bal) AS total, MIN(due)::text AS "oldestDue"
             FROM open JOIN patients pt ON pt.id = open.patient_id
            GROUP BY pt.id, pt.full_name, pt.patient_number, pt.phone
            ORDER BY total DESC
            LIMIT $4`,
          [s.organizationId, s.locationIds, s.today, p.limit],
        );
        return { rows };
      },
    },
    {
      key: 'doctor-revenue',
      title: 'Doctor performance',
      description:
        'Billed, collected and commission per doctor — what each one brings in.',
      category: 'revenue',
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'doctor', header: 'Doctor', type: 'text', weight: 2 },
        {
          key: 'procedures',
          header: 'Procedures',
          type: 'number',
          total: true,
        },
        { key: 'gross', header: 'Gross', type: 'money', total: true },
        { key: 'discount', header: 'Discount', type: 'money', total: true },
        { key: 'billed', header: 'Billed', type: 'money', total: true },
        { key: 'collected', header: 'Collected', type: 'money', total: true },
        { key: 'commission', header: 'Commission', type: 'money', total: true },
        {
          key: 'clinicShare',
          header: 'Clinic keeps',
          type: 'money',
          total: true,
        },
        { key: 'collectedPct', header: 'Collected %', type: 'percent' },
      ],
      async run(s, p) {
        const rows = await sqlRows<Record<string, string | null>>(
          db,
          `WITH billed AS (
             SELECT c.doctor_id, SUM(c.quantity) AS n, (SUM(c.gross_amount) * 100)::bigint AS gross,
                    (SUM(c.discount_amount) * 100)::bigint AS discount,
                    (SUM(c.net_amount) * 100)::bigint AS billed
               FROM charges c JOIN invoices i ON i.id = c.invoice_id
              WHERE c.organization_id = $1 AND c.location_id = ANY($2) AND c.status = 'ACTIVE'
                AND i.status = 'ISSUED' AND i.issue_date BETWEEN $3 AND $4
              GROUP BY 1),
           collected AS (
             SELECT c.doctor_id, (SUM(${preTaxAllocationSql('pa', 'c')}) * 100)::bigint AS collected
               FROM payment_allocations pa JOIN charges c ON c.id = pa.charge_id
              WHERE pa.organization_id = $1 AND pa.location_id = ANY($2)
                AND pa.created_at >= $5 AND pa.created_at < $6
              GROUP BY 1),
           commission AS (
             SELECT a.employee_id AS doctor_id, SUM(ce.amount_minor) AS commission
               FROM commission_entries ce
               JOIN employee_org_location_assignments a ON a.id = ce.assignment_id
              WHERE ce.organization_id = $1 AND ce.location_id = ANY($2)
                AND ce.created_at >= $5 AND ce.created_at < $6
              GROUP BY 1),
           doctors AS (SELECT doctor_id FROM billed UNION SELECT doctor_id FROM collected
                       UNION SELECT doctor_id FROM commission)
           SELECT d.doctor_id, e.full_name, COALESCE(b.n, 0) AS n, COALESCE(b.gross, 0) AS gross,
                  COALESCE(b.discount, 0) AS discount, COALESCE(b.billed, 0) AS billed,
                  COALESCE(col.collected, 0) AS collected, COALESCE(cm.commission, 0) AS commission
             FROM doctors d
             LEFT JOIN billed b ON b.doctor_id IS NOT DISTINCT FROM d.doctor_id
             LEFT JOIN collected col ON col.doctor_id IS NOT DISTINCT FROM d.doctor_id
             LEFT JOIN commission cm ON cm.doctor_id IS NOT DISTINCT FROM d.doctor_id
             LEFT JOIN employees e ON e.id = d.doctor_id
            WHERE $7::uuid IS NULL OR d.doctor_id = $7::uuid
            ORDER BY COALESCE(b.billed, 0) DESC`,
          [...base(s, p), p.start, p.end, p.doctorId ?? null],
        );
        return {
          rows: rows.map((x) => {
            const billed = Number(x.billed);
            const collected = Number(x.collected);
            const commission = Number(x.commission);
            return {
              doctor: x.full_name ?? 'No doctor',
              procedures: Number(x.n),
              gross: Number(x.gross),
              discount: Number(x.discount),
              billed,
              collected,
              commission,
              clinicShare: collected - commission,
              collectedPct: percentOfTotal(collected, billed),
            };
          }),
          notes: [
            'Billed = issued invoices by invoice date. Collected = payments applied in the period (unapplied money subtracts).',
          ],
        };
      },
    },
    {
      key: 'service-revenue',
      title: 'Revenue by service',
      description: 'Which treatments earn the most, with discounts given.',
      category: 'revenue',
      filters: { dates: 'range' },
      columns: [
        { key: 'service', header: 'Service', type: 'text', weight: 3 },
        {
          key: 'quantity',
          header: 'Qty',
          type: 'number',
          total: true,
          weight: 0.7,
        },
        { key: 'gross', header: 'Gross', type: 'money', total: true },
        { key: 'discount', header: 'Discount', type: 'money', total: true },
        { key: 'net', header: 'Net', type: 'money', total: true },
        { key: 'share', header: 'Share', type: 'percent', weight: 0.8 },
      ],
      async run(s, p) {
        const rows = await sqlRows<Record<string, string>>(
          db,
          `SELECT COALESCE(sv.name, c.description) AS service, SUM(c.quantity) AS quantity,
                  (SUM(c.gross_amount) * 100)::bigint AS gross,
                  (SUM(c.discount_amount) * 100)::bigint AS discount,
                  (SUM(c.net_amount) * 100)::bigint AS net
             FROM charges c
             JOIN invoices i ON i.id = c.invoice_id
             LEFT JOIN services sv ON sv.id = c.service_id
            WHERE c.organization_id = $1 AND c.location_id = ANY($2) AND c.status = 'ACTIVE'
              AND i.status = 'ISSUED' AND i.issue_date BETWEEN $3 AND $4
              AND ($5::uuid IS NULL OR c.doctor_id = $5::uuid)
            GROUP BY 1
            ORDER BY net DESC
            LIMIT $6`,
          [...base(s, p), p.doctorId ?? null, p.limit],
        );
        const total = rows.reduce((a, x) => a + Number(x.net), 0);
        return {
          rows: rows.map((x) => ({
            service: x.service,
            quantity: Number(x.quantity),
            gross: Number(x.gross),
            discount: Number(x.discount),
            net: Number(x.net),
            share: percentOfTotal(Number(x.net), total),
          })),
        };
      },
    },
    {
      key: 'discounts',
      title: 'Discounts given',
      description: 'Every discount on issued invoices and who gave it.',
      category: 'revenue',
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'date', header: 'Date', type: 'date' },
        { key: 'invoice', header: 'Invoice #', type: 'text', weight: 1.2 },
        { key: 'patient', header: 'Patient', type: 'text', weight: 2 },
        { key: 'service', header: 'Service', type: 'text', weight: 2.2 },
        { key: 'discountName', header: 'Discount', type: 'text', weight: 1.4 },
        { key: 'gross', header: 'Gross', type: 'money', total: true },
        { key: 'discount', header: 'Discount amt', type: 'money', total: true },
        { key: 'givenBy', header: 'Given by', type: 'text', weight: 1.4 },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `SELECT i.issue_date::text AS date, i.invoice_number AS invoice, pt.full_name AS patient,
                  c.description AS service,
                  COALESCE(c.discount_name, CASE WHEN c.is_custom_discount THEN 'Custom' END, 'Discount')
                    || CASE WHEN c.discount_kind = 'PERCENTAGE' THEN ' (' || trim(to_char(c.discount_value, 'FM990.##')) || '%)' ELSE '' END
                    AS "discountName",
                  (c.gross_amount * 100)::bigint AS gross, (c.discount_amount * 100)::bigint AS discount,
                  u.name AS "givenBy"
             FROM charges c
             JOIN invoices i ON i.id = c.invoice_id
             JOIN patients pt ON pt.id = c.patient_id
             LEFT JOIN users u ON u.uuid = c.discount_applied_by
            WHERE c.organization_id = $1 AND c.location_id = ANY($2) AND c.status = 'ACTIVE'
              AND c.discount_amount > 0 AND i.status = 'ISSUED' AND i.issue_date BETWEEN $3 AND $4
            ORDER BY i.issue_date DESC, i.invoice_number DESC
            LIMIT $5`,
          [...base(s, p), p.limit],
        );
        return { rows };
      },
    },
    {
      key: 'refunds',
      title: 'Refunds',
      description: 'Money returned to patients, with the reason.',
      category: 'revenue',
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'date', header: 'Date', type: 'date' },
        { key: 'refund', header: 'Refund #', type: 'text', weight: 1.2 },
        { key: 'source', header: 'For', type: 'text', weight: 0.7 },
        { key: 'patient', header: 'Patient', type: 'text', weight: 2 },
        { key: 'account', header: 'Paid from', type: 'text', weight: 1.3 },
        { key: 'reason', header: 'Reason', type: 'text', weight: 3 },
        { key: 'amount', header: 'Amount', type: 'money', total: true },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `SELECT * FROM (
             SELECT r.refund_date::text AS date, r.refund_number AS refund, 'Clinic' AS source,
                    pt.full_name AS patient, r.payment_account_name AS account, r.reason,
                    (r.amount * 100)::bigint AS amount, r.refunded_at AS at
               FROM refunds r JOIN patients pt ON pt.id = r.patient_id
              WHERE r.organization_id = $1 AND r.location_id = ANY($2) AND r.refund_date BETWEEN $3 AND $4
             UNION ALL
             SELECT to_char(lr.refunded_at AT TIME ZONE $7, 'YYYY-MM-DD'), lr.refund_no, 'Lab', pt.full_name,
                    initcap(replace(lr.method::text, '_', ' ')), lr.reason, lr.amount_minor, lr.refunded_at
               FROM lab_refunds lr JOIN patients pt ON pt.id = lr.patient_id
              WHERE lr.organization_id = $1 AND lr.location_id = ANY($2)
                AND lr.refunded_at >= $5 AND lr.refunded_at < $6
           ) x ORDER BY at DESC LIMIT $8`,
          [...base(s, p), p.start, p.end, s.tz, p.limit],
        );
        return { rows: dropAt(rows) };
      },
    },
  ];
}
