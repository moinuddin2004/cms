import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { monthStart } from '../core/report-dates';
import { percentOfTotal } from '../core/report-format';
import type {
  ReportDefinition,
  ReportParams,
  ReportRow,
  ReportScope,
} from '../core/report.types';
import { VENDOR_BILL_LIVE } from '../finance/finance-data.service';
import { expenseLabel } from '../finance/profit-loss';

const base = (s: ReportScope, p: ReportParams) => [
  s.organizationId,
  s.locationIds,
  p.from,
  p.to,
];

/** Expenses, payroll, commissions and lab bills — where the money goes. */
export function costReports(db: DataSource): ReportDefinition[] {
  return [
    {
      key: 'expenses',
      title: 'Expense register',
      description: 'Every expense with category, method and who recorded it.',
      category: 'expenses',
      filters: { dates: 'range', expenseCategory: true },
      landscape: true,
      columns: [
        { key: 'date', header: 'Date', type: 'date' },
        { key: 'category', header: 'Category', type: 'text', weight: 1.3 },
        { key: 'description', header: 'Description', type: 'text', weight: 3 },
        { key: 'method', header: 'Paid by', type: 'text', weight: 1.1 },
        { key: 'recordedBy', header: 'Recorded by', type: 'text', weight: 1.5 },
        { key: 'location', header: 'Location', type: 'text', weight: 1.3 },
        { key: 'amount', header: 'Amount', type: 'money', total: true },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow & { category: string }>(
          db,
          `SELECT e.expense_date::text AS date, e.category::text AS category, e.description,
                  initcap(replace(e.payment_method::text, '_', ' ')) AS method,
                  emp.full_name AS "recordedBy", l.name AS location,
                  (e.amount * 100)::bigint AS amount
             FROM expenses e
             JOIN locations l ON l.id = e.location_id
             LEFT JOIN employees emp ON emp.id = e.recorded_by
            WHERE e.organization_id = $1 AND e.location_id = ANY($2)
              AND e.expense_date BETWEEN $3 AND $4
              AND ($5::text IS NULL OR e.category::text = $5::text)
            ORDER BY e.expense_date DESC, e.created_at DESC
            LIMIT $6`,
          [...base(s, p), p.category ?? null, p.limit],
        );
        return {
          rows: rows.map((r) => ({ ...r, category: expenseLabel(r.category) })),
        };
      },
    },
    {
      key: 'expense-summary',
      title: 'Expenses by category',
      description: 'Where operating money goes, with each category’s share.',
      category: 'expenses',
      filters: { dates: 'range' },
      columns: [
        { key: 'category', header: 'Category', type: 'text', weight: 2 },
        { key: 'entries', header: 'Entries', type: 'number', total: true },
        { key: 'amount', header: 'Amount', type: 'money', total: true },
        { key: 'share', header: 'Share', type: 'percent' },
      ],
      async run(s, p) {
        const rows = await sqlRows<{
          category: string;
          entries: string;
          amount: string;
        }>(
          db,
          `SELECT category::text AS category, COUNT(*) AS entries, (SUM(amount) * 100)::bigint AS amount
             FROM expenses
            WHERE organization_id = $1 AND location_id = ANY($2) AND expense_date BETWEEN $3 AND $4
            GROUP BY 1 ORDER BY 3 DESC`,
          base(s, p),
        );
        const total = rows.reduce((a, r) => a + Number(r.amount), 0);
        return {
          rows: rows.map((r) => ({
            category: expenseLabel(r.category),
            entries: Number(r.entries),
            amount: Number(r.amount),
            share: percentOfTotal(Number(r.amount), total),
          })),
        };
      },
    },
    {
      key: 'payroll',
      title: 'Payroll register',
      description: 'Salary and commission paid out per employee per month.',
      category: 'staff',
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'period', header: 'Month', type: 'text', weight: 1.2 },
        { key: 'employee', header: 'Employee', type: 'text', weight: 2.2 },
        { key: 'location', header: 'Location', type: 'text', weight: 1.4 },
        { key: 'base', header: 'Salary', type: 'money', total: true },
        { key: 'commission', header: 'Commission', type: 'money', total: true },
        { key: 'total', header: 'Total', type: 'money', total: true },
        { key: 'status', header: 'Status', type: 'text', weight: 0.9 },
        { key: 'paidOn', header: 'Paid on', type: 'date' },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `SELECT to_char(make_date(pr.year, pr.month, 1), 'Mon YYYY') AS period,
                  e.full_name AS employee, l.name AS location,
                  CASE WHEN pr.total_paisa > 0 THEN pr.base_salary_paisa
                       ELSE ROUND(pr.salary_amount * 100)::bigint END AS base,
                  CASE WHEN pr.total_paisa > 0 THEN pr.commission_paisa ELSE 0 END AS commission,
                  CASE WHEN pr.total_paisa > 0 THEN pr.total_paisa
                       ELSE ROUND(pr.salary_amount * 100)::bigint END AS total,
                  initcap(replace(pr.status::text, '_', ' ')) AS status,
                  to_char(pr.paid_at AT TIME ZONE $5, 'YYYY-MM-DD') AS "paidOn"
             FROM payroll_records pr
             JOIN employees e ON e.id = pr.employee_id
             JOIN locations l ON l.id = pr.location_id
            WHERE pr.organization_id = $1 AND pr.location_id = ANY($2)
              AND make_date(pr.year, pr.month, 1) BETWEEN $3::date AND $4::date
            ORDER BY pr.year DESC, pr.month DESC, e.full_name
            LIMIT $6`,
          [
            s.organizationId,
            s.locationIds,
            monthStart(p.from),
            p.to,
            s.tz,
            p.limit,
          ],
        );
        return {
          rows,
          notes: [
            'Payroll counts by its month: every month that starts inside the range.',
          ],
        };
      },
    },
    {
      key: 'commissions',
      title: 'Doctor commissions',
      description:
        'Commission earned on collections, settled and still pending.',
      category: 'staff',
      filters: { dates: 'range', doctor: true },
      columns: [
        { key: 'doctor', header: 'Doctor', type: 'text', weight: 2 },
        { key: 'location', header: 'Location', type: 'text', weight: 1.4 },
        { key: 'base', header: 'Collected on', type: 'money', total: true },
        { key: 'earned', header: 'Earned', type: 'money', total: true },
        { key: 'settled', header: 'Settled', type: 'money', total: true },
        { key: 'pending', header: 'Pending', type: 'money', total: true },
      ],
      async run(s, p) {
        const rows = await sqlRows<Record<string, string>>(
          db,
          `SELECT e.full_name AS doctor, l.name AS location,
                  SUM(ce.base_paisa) FILTER (WHERE ce.source_type = 'ALLOCATION') AS base,
                  SUM(ce.amount_paisa) AS earned,
                  COALESCE(SUM(ce.amount_paisa) FILTER (WHERE ce.settlement_id IS NOT NULL), 0) AS settled
             FROM commission_entries ce
             JOIN employee_org_location_assignments a ON a.id = ce.assignment_id
             JOIN employees e ON e.id = a.employee_id
             JOIN locations l ON l.id = ce.location_id
            WHERE ce.organization_id = $1 AND ce.location_id = ANY($2)
              AND ce.created_at >= $3 AND ce.created_at < $4
              AND ($5::uuid IS NULL OR a.employee_id = $5::uuid)
            GROUP BY e.id, e.full_name, l.id, l.name
            ORDER BY earned DESC`,
          [s.organizationId, s.locationIds, p.start, p.end, p.doctorId ?? null],
        );
        return {
          rows: rows.map((r) => ({
            doctor: r.doctor,
            location: r.location,
            base: Number(r.base ?? 0),
            earned: Number(r.earned),
            settled: Number(r.settled),
            pending: Number(r.earned) - Number(r.settled),
          })),
        };
      },
    },
    {
      key: 'lab-bills',
      title: 'Lab bills',
      description:
        'What labs billed the clinic, what is paid and what is still owed.',
      category: 'lab',
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'date', header: 'Bill date', type: 'date' },
        { key: 'bill', header: 'Bill #', type: 'text', weight: 1.2 },
        { key: 'lab', header: 'Lab', type: 'text', weight: 2 },
        {
          key: 'labInvoice',
          header: 'Lab invoice #',
          type: 'text',
          weight: 1.2,
        },
        { key: 'total', header: 'Total', type: 'money', total: true },
        { key: 'paid', header: 'Paid', type: 'money', total: true },
        { key: 'balance', header: 'Balance', type: 'money', total: true },
        { key: 'due', header: 'Due', type: 'date' },
        { key: 'status', header: 'Status', type: 'text', weight: 1 },
      ],
      async run(s, p) {
        const rows = await sqlRows<ReportRow>(
          db,
          `SELECT vb.bill_date::text AS date, vb.bill_no AS bill, lb.name AS lab,
                  vb.vendor_invoice_no AS "labInvoice", vb.total_paisa AS total, vb.paid_paisa AS paid,
                  vb.balance_paisa AS balance, vb.due_on::text AS due,
                  CASE WHEN vb.balance_paisa > 0 AND vb.due_on < $5::date THEN 'Overdue'
                       ELSE initcap(replace(vb.status::text, '_', ' ')) END AS status
             FROM vendor_bills vb JOIN labs lb ON lb.id = vb.lab_id
            WHERE vb.organization_id = $1 AND vb.location_id = ANY($2)
              AND vb.status IN ${VENDOR_BILL_LIVE} AND vb.bill_date BETWEEN $3 AND $4
            ORDER BY vb.bill_date DESC, vb.bill_no DESC
            LIMIT $6`,
          [...base(s, p), s.today, p.limit],
        );
        return { rows, notes: ['Draft and voided bills are left out.'] };
      },
    },
  ];
}
