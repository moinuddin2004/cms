import { DataSource } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { percentOfTotal } from '../core/report-format';
import type { ReportDefinition, ReportRow } from '../core/report.types';
import type { FinanceOverviewService } from '../finance/finance-overview.service';
import { expenseLabel } from '../finance/profit-loss';

/** Row kinds the P&L uses so screens and files can style its lines. */
export type PnlRowKind = 'section' | 'line' | 'subtotal' | 'total';

const BASIS_NOTE = {
  collected:
    'Revenue = money collected in the period (receipts minus refunds).',
  billed: 'Revenue = work billed in the period (issued invoices).',
};

export function financeReports(
  db: DataSource,
  finance: FinanceOverviewService,
): ReportDefinition[] {
  return [
    {
      key: 'profit-loss',
      title: 'Profit & loss',
      description: 'Revenue, costs and net profit for the period.',
      category: 'finance',
      filters: { dates: 'range', basis: true },
      columns: [
        { key: 'line', header: 'Item', type: 'text', weight: 3 },
        { key: 'amount', header: 'Amount', type: 'money' },
        { key: 'share', header: '% of revenue', type: 'percent' },
      ],
      async run(s, p) {
        const pl = await finance.profitLoss(s, p, p.basis);
        const rev = pl.revenue.total;
        const row = (
          kind: PnlRowKind,
          line: string,
          amount: number | null,
        ): ReportRow => ({
          _kind: kind,
          line,
          amount,
          share: amount == null ? null : percentOfTotal(amount, rev),
        });
        const rows: ReportRow[] = [
          row('section', 'Revenue', null),
          row('line', 'Clinic services', pl.revenue.clinic),
          row('line', 'Lab work', pl.revenue.lab),
          row('subtotal', 'Total revenue', rev),
          row('section', 'Direct costs', null),
          row('line', 'Lab bills', pl.directCosts.labBills),
          row('line', 'Doctor commissions', pl.directCosts.commissions),
          row('subtotal', 'Gross profit', pl.grossProfit),
          row('section', 'Operating expenses', null),
          row('line', 'Salaries (payroll)', pl.operating.salaries),
          ...pl.operating.expenses.map((e) =>
            row('line', expenseLabel(e.category), e.amount),
          ),
          row('subtotal', 'Total operating expenses', pl.operating.total),
          row(
            'total',
            pl.netProfit < 0 ? 'Net loss' : 'Net profit',
            pl.netProfit,
          ),
        ];
        return {
          rows,
          totals: null,
          summary: [
            { label: 'Revenue', value: rev, type: 'money' },
            { label: 'Total costs', value: pl.totalCosts, type: 'money' },
            {
              label: pl.netProfit < 0 ? 'Net loss' : 'Net profit',
              value: pl.netProfit,
              type: 'money',
            },
            { label: 'Margin', value: pl.marginPct ?? 0, type: 'percent' },
          ],
          notes: [
            BASIS_NOTE[p.basis],
            'Costs: lab bills by bill date, commission when earned, salaries by payroll month, expenses by expense date.',
          ],
        };
      },
    },
    {
      key: 'cash-book',
      title: 'Daily cash book',
      description: 'Day by day: money in, money out and the net.',
      category: 'finance',
      filters: { dates: 'range' },
      landscape: true,
      columns: [
        { key: 'date', header: 'Date', type: 'date' },
        {
          key: 'clinicIn',
          header: 'Clinic receipts',
          type: 'money',
          total: true,
        },
        { key: 'labIn', header: 'Lab receipts', type: 'money', total: true },
        { key: 'refunds', header: 'Refunds', type: 'money', total: true },
        { key: 'expenses', header: 'Expenses', type: 'money', total: true },
        { key: 'labPaid', header: 'Paid to labs', type: 'money', total: true },
        {
          key: 'salaries',
          header: 'Salaries paid',
          type: 'money',
          total: true,
        },
        { key: 'net', header: 'Net cash', type: 'money', total: true },
      ],
      async run(s, p) {
        // $1 org, $2 locations, $3/$4 days, $5/$6 instants, $7 tz.
        const rows = await sqlRows<Record<string, string>>(
          db,
          `WITH days AS (SELECT d::date AS day FROM generate_series($3::date, $4::date, interval '1 day') d),
           clinic_in AS (SELECT payment_date AS day, (SUM(amount) * 100)::bigint AS v FROM payments
                          WHERE organization_id = $1 AND location_id = ANY($2) AND payment_date BETWEEN $3 AND $4
                          GROUP BY 1),
           lab_in AS (SELECT received_on AS day, SUM(amount_paisa) AS v FROM lab_payments
                       WHERE organization_id = $1 AND location_id = ANY($2) AND received_on BETWEEN $3 AND $4
                       GROUP BY 1),
           refunds_out AS (
             SELECT day, SUM(v) AS v FROM (
               SELECT refund_date AS day, (SUM(amount) * 100)::bigint AS v FROM refunds
                WHERE organization_id = $1 AND location_id = ANY($2) AND refund_date BETWEEN $3 AND $4
                GROUP BY 1
               UNION ALL
               SELECT (refunded_at AT TIME ZONE $7)::date, SUM(amount_paisa) FROM lab_refunds
                WHERE organization_id = $1 AND location_id = ANY($2) AND refunded_at >= $5 AND refunded_at < $6
                GROUP BY 1) r GROUP BY 1),
           expenses_out AS (SELECT expense_date AS day, (SUM(amount) * 100)::bigint AS v FROM expenses
                             WHERE organization_id = $1 AND location_id = ANY($2) AND expense_date BETWEEN $3 AND $4
                             GROUP BY 1),
           lab_out AS (SELECT paid_on AS day, SUM(amount_paisa) AS v FROM vendor_payments
                        WHERE organization_id = $1 AND location_id = ANY($2) AND status = 'posted'
                          AND paid_on BETWEEN $3 AND $4
                        GROUP BY 1),
           salary_out AS (SELECT (paid_at AT TIME ZONE $7)::date AS day,
                                 SUM(CASE WHEN total_paisa > 0 THEN total_paisa
                                          ELSE ROUND(salary_amount * 100)::bigint END) AS v
                            FROM payroll_records
                           WHERE organization_id = $1 AND location_id = ANY($2) AND status = 'paid'
                             AND paid_at >= $5 AND paid_at < $6
                           GROUP BY 1)
           SELECT days.day::text AS date,
                  COALESCE(ci.v, 0) AS clinic_in, COALESCE(li.v, 0) AS lab_in, COALESCE(ro.v, 0) AS refunds,
                  COALESCE(eo.v, 0) AS expenses, COALESCE(lo.v, 0) AS lab_paid, COALESCE(so.v, 0) AS salaries
             FROM days
             LEFT JOIN clinic_in ci ON ci.day = days.day
             LEFT JOIN lab_in li ON li.day = days.day
             LEFT JOIN refunds_out ro ON ro.day = days.day
             LEFT JOIN expenses_out eo ON eo.day = days.day
             LEFT JOIN lab_out lo ON lo.day = days.day
             LEFT JOIN salary_out so ON so.day = days.day
            ORDER BY days.day DESC`,
          [s.organizationId, s.locationIds, p.from, p.to, p.start, p.end, s.tz],
        );
        const mapped = rows.map((r) => {
          const n = (k: string) => Number(r[k]);
          return {
            date: r.date,
            clinicIn: n('clinic_in'),
            labIn: n('lab_in'),
            refunds: n('refunds'),
            expenses: n('expenses'),
            labPaid: n('lab_paid'),
            salaries: n('salaries'),
            net:
              n('clinic_in') +
              n('lab_in') -
              n('refunds') -
              n('expenses') -
              n('lab_paid') -
              n('salaries'),
          };
        });
        // Days with no money movement are noise in a cash book.
        const active = mapped.filter(
          (d) =>
            d.clinicIn ||
            d.labIn ||
            d.refunds ||
            d.expenses ||
            d.labPaid ||
            d.salaries,
        );
        return {
          rows: active,
          notes: [
            'Days without any money movement are left out.',
            'Cash basis: salaries count on the day payroll was marked paid; lab payments on the day paid.',
          ],
        };
      },
    },
  ];
}
