import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClockService } from 'src/common/clock/clock.service';
import { addDays } from 'src/common/clock/tz.util';
import { sqlRows } from 'src/common/database/sql';
import { fromMinor } from 'src/billing/common/money';
import { preTaxAllocationSql } from 'src/billing/tax/invoice-tax';
import {
  addMonths,
  monthLabel,
  monthStart,
  previousRange,
  trailingMonths,
} from '../core/report-dates';
import type {
  ReportParams,
  ReportScope,
  RevenueBasis,
} from '../core/report.types';
import {
  FinanceDataService,
  LAB_INVOICE_LIVE,
  Period,
} from './finance-data.service';
import {
  addComponents,
  buildProfitLoss,
  changePct,
  emptyComponents,
  expenseLabel,
  ProfitLoss,
} from './profit-loss';

const TREND_MONTHS = 12;
const TOP_N = 6;

const r = fromMinor;

/** P&L with money in rupees (the API shape). */
function pnlToRupees(p: ProfitLoss) {
  return {
    basis: p.basis,
    revenue: {
      clinic: r(p.revenue.clinic),
      lab: r(p.revenue.lab),
      total: r(p.revenue.total),
    },
    collected: r(p.collected),
    billed: r(p.billed),
    directCosts: {
      labBills: r(p.directCosts.labBills),
      commissions: r(p.directCosts.commissions),
      total: r(p.directCosts.total),
    },
    grossProfit: r(p.grossProfit),
    operating: {
      salaries: r(p.operating.salaries),
      expenses: p.operating.expenses.map((e) => ({
        category: e.category,
        label: expenseLabel(e.category),
        amount: r(e.amount),
      })),
      total: r(p.operating.total),
    },
    totalCosts: r(p.totalCosts),
    netProfit: r(p.netProfit),
    marginPct: p.marginPct,
  };
}

export type ProfitLossView = ReturnType<typeof pnlToRupees>;

/**
 * Everything the owner's finance dashboard shows, for one period and the
 * period before it: P&L, KPIs, a 12-month trend and the breakdowns.
 */
@Injectable()
export class FinanceOverviewService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly data: FinanceDataService,
    private readonly clock: ClockService,
  ) {}

  /** P&L of a whole range (months rolled up). */
  async profitLoss(
    scope: ReportScope,
    period: Period,
    basis: RevenueBasis,
  ): Promise<ProfitLoss> {
    const months = await this.data.monthlyComponents(scope, period);
    const total = [...months.values()].reduce(addComponents, emptyComponents());
    return buildProfitLoss(total, basis);
  }

  async overview(scope: ReportScope, p: ReportParams) {
    const period: Period = {
      from: p.from,
      to: p.to,
      start: p.start,
      end: p.end,
    };
    const prev = previousRange(p.from, p.to);
    const prevPeriod = this.period(scope, prev.from, prev.to);
    const trendFrom = addMonths(monthStart(p.to), -(TREND_MONTHS - 1));
    const trendPeriod = this.period(scope, trendFrom, p.to);

    const [
      current,
      previous,
      trendMonths,
      balances,
      doctors,
      services,
      accounts,
      counts,
      warnings,
    ] = await Promise.all([
      this.profitLoss(scope, period, p.basis),
      this.profitLoss(scope, prevPeriod, p.basis),
      this.data.monthlyComponents(scope, trendPeriod),
      this.balances(scope),
      this.topDoctors(scope, period, p.basis),
      this.topServices(scope, period),
      this.collectionsByAccount(scope, period),
      this.counts(scope, period),
      this.warnings(scope, period),
    ]);

    const trend = trailingMonths(p.to, TREND_MONTHS).map((ym) => {
      const pl = buildProfitLoss(
        trendMonths.get(ym) ?? emptyComponents(),
        p.basis,
      );
      return {
        month: ym,
        label: monthLabel(ym),
        revenue: r(pl.revenue.total),
        costs: r(pl.totalCosts),
        profit: r(pl.netProfit),
      };
    });

    const kpi = (curr: number, before: number) => ({
      value: r(curr),
      previous: r(before),
      changePct: changePct(curr, before),
    });

    return {
      period: { from: p.from, to: p.to },
      previousPeriod: prev,
      scope: { label: scope.label, locationCount: scope.locationIds.length },
      basis: p.basis,
      kpis: {
        revenue: kpi(current.revenue.total, previous.revenue.total),
        costs: kpi(current.totalCosts, previous.totalCosts),
        netProfit: kpi(current.netProfit, previous.netProfit),
        collected: kpi(current.collected, previous.collected),
        billed: kpi(current.billed, previous.billed),
        marginPct: current.marginPct,
        previousMarginPct: previous.marginPct,
      },
      pnl: pnlToRupees(current),
      trend,
      costBreakdown: this.costBreakdown(current),
      balances,
      topDoctors: doctors,
      topServices: services,
      collectionsByAccount: accounts,
      counts,
      warnings,
    };
  }

  period(scope: ReportScope, from: string, to: string): Period {
    return {
      from,
      to,
      start: this.clock.dayRange(scope.tz, from).start,
      end: this.clock.dayRange(scope.tz, addDays(to, 1)).start,
    };
  }

  private costBreakdown(p: ProfitLoss) {
    const items = [
      { key: 'salaries', label: 'Salaries', amount: p.operating.salaries },
      {
        key: 'commissions',
        label: 'Doctor commissions',
        amount: p.directCosts.commissions,
      },
      { key: 'lab', label: 'Lab bills', amount: p.directCosts.labBills },
      ...p.operating.expenses.map((e) => ({
        key: `expense:${e.category}`,
        label: expenseLabel(e.category),
        amount: e.amount,
      })),
    ].filter((i) => i.amount !== 0);
    return items
      .sort((a, b) => b.amount - a.amount)
      .map((i) => ({ ...i, amount: r(i.amount) }));
  }

  /** What patients owe (aged by due date), what the clinic owes labs, advances held. */
  private async balances(scope: ReportScope) {
    const [row] = await sqlRows<Record<string, string>>(
      this.dataSource,
      `WITH open AS (
         SELECT (balance_due * 100)::bigint AS bal, due_date AS due
           FROM invoices
          WHERE organization_id = $1 AND location_id = ANY($2) AND status = 'ISSUED' AND balance_due > 0
         UNION ALL
         SELECT balance_minor, COALESCE(due_on, issued_on)
           FROM lab_invoices
          WHERE organization_id = $1 AND location_id = ANY($2) AND status IN ${LAB_INVOICE_LIVE}
            AND balance_minor > 0)
       SELECT
         COALESCE(SUM(bal), 0) AS receivable,
         COUNT(*) AS open_invoices,
         COALESCE(SUM(bal) FILTER (WHERE due >= $3::date), 0) AS current,
         COALESCE(SUM(bal) FILTER (WHERE $3::date - due BETWEEN 1 AND 30), 0) AS d30,
         COALESCE(SUM(bal) FILTER (WHERE $3::date - due BETWEEN 31 AND 60), 0) AS d60,
         COALESCE(SUM(bal) FILTER (WHERE $3::date - due BETWEEN 61 AND 90), 0) AS d90,
         COALESCE(SUM(bal) FILTER (WHERE $3::date - due > 90), 0) AS d90plus,
         (SELECT COALESCE(SUM(balance_minor), 0) FROM vendor_bills
           WHERE organization_id = $1 AND location_id = ANY($2)
             AND status IN ('approved', 'partially_paid')) AS payable,
         (SELECT COALESCE(SUM(balance_minor), 0) FROM vendor_bills
           WHERE organization_id = $1 AND location_id = ANY($2)
             AND status IN ('approved', 'partially_paid') AND due_on < $3::date) AS payable_overdue,
         (SELECT COALESCE(SUM((amount - allocated_amount - refunded_amount) * 100), 0)::bigint
            FROM payments
           WHERE organization_id = $1 AND location_id = ANY($2)) AS advances
       FROM open`,
      [scope.organizationId, scope.locationIds, scope.today],
    );
    const n = (k: string) => Number(row?.[k] ?? 0);
    return {
      receivable: r(n('receivable')),
      openInvoices: n('open_invoices'),
      aging: [
        { bucket: 'Not due', amount: r(n('current')) },
        { bucket: '1–30 days', amount: r(n('d30')) },
        { bucket: '31–60 days', amount: r(n('d60')) },
        { bucket: '61–90 days', amount: r(n('d90')) },
        { bucket: '90+ days', amount: r(n('d90plus')) },
      ],
      payable: r(n('payable')),
      payableOverdue: r(n('payable_overdue')),
      advances: r(n('advances')),
    };
  }

  /** Revenue per doctor: billed on issued invoices, or collected (allocations). */
  private async topDoctors(
    scope: ReportScope,
    period: Period,
    basis: RevenueBasis,
  ) {
    const rows = await sqlRows<{
      doctor_id: string | null;
      name: string | null;
      v: string;
    }>(
      this.dataSource,
      basis === 'billed'
        ? `SELECT c.doctor_id, e.full_name AS name, (SUM(c.net_amount) * 100)::bigint AS v
             FROM charges c
             JOIN invoices i ON i.id = c.invoice_id
             LEFT JOIN employees e ON e.id = c.doctor_id
            WHERE c.organization_id = $1 AND c.location_id = ANY($2) AND c.status = 'ACTIVE'
              AND i.status = 'ISSUED' AND i.issue_date BETWEEN $3 AND $4
            GROUP BY 1, 2`
        : `SELECT c.doctor_id, e.full_name AS name, (SUM(${preTaxAllocationSql('pa', 'c')}) * 100)::bigint AS v
             FROM payment_allocations pa
             JOIN charges c ON c.id = pa.charge_id
             LEFT JOIN employees e ON e.id = c.doctor_id
            WHERE pa.organization_id = $1 AND pa.location_id = ANY($2)
              AND pa.created_at >= $3 AND pa.created_at < $4
            GROUP BY 1, 2`,
      basis === 'billed'
        ? [scope.organizationId, scope.locationIds, period.from, period.to]
        : [scope.organizationId, scope.locationIds, period.start, period.end],
    );
    const sorted = rows
      .map((x) => ({
        doctorId: x.doctor_id,
        name: x.name ?? 'No doctor',
        amount: Number(x.v),
      }))
      .filter((x) => x.amount !== 0)
      .sort((a, b) => b.amount - a.amount);
    return this.topWithOthers(sorted, (rest) => ({
      doctorId: null,
      name: 'Others',
      amount: rest,
    }));
  }

  private async topServices(scope: ReportScope, period: Period) {
    const rows = await sqlRows<{ name: string; qty: string; v: string }>(
      this.dataSource,
      `SELECT COALESCE(s.name, c.description) AS name, SUM(c.quantity) AS qty,
              (SUM(c.net_amount) * 100)::bigint AS v
         FROM charges c
         JOIN invoices i ON i.id = c.invoice_id
         LEFT JOIN services s ON s.id = c.service_id
        WHERE c.organization_id = $1 AND c.location_id = ANY($2) AND c.status = 'ACTIVE'
          AND i.status = 'ISSUED' AND i.issue_date BETWEEN $3 AND $4
        GROUP BY 1
        ORDER BY 3 DESC
        LIMIT ${TOP_N}`,
      [scope.organizationId, scope.locationIds, period.from, period.to],
    );
    return rows.map((x) => ({
      name: x.name,
      count: Number(x.qty),
      amount: r(Number(x.v)),
    }));
  }

  /** Cash in by payment account (refunds out of the same account subtract). */
  private async collectionsByAccount(scope: ReportScope, period: Period) {
    const rows = await sqlRows<{ account: string; v: string }>(
      this.dataSource,
      `SELECT account, SUM(v)::bigint AS v FROM (
         SELECT payment_account_name AS account, (SUM(amount) * 100)::bigint AS v
           FROM payments
          WHERE organization_id = $1 AND location_id = ANY($2) AND payment_date BETWEEN $3 AND $4
          GROUP BY 1
         UNION ALL
         SELECT payment_account_name, -(SUM(amount) * 100)::bigint
           FROM refunds
          WHERE organization_id = $1 AND location_id = ANY($2) AND refund_date BETWEEN $3 AND $4
          GROUP BY 1
         UNION ALL
         SELECT 'Lab · ' || initcap(replace(method::text, '_', ' ')), SUM(amount_minor)
           FROM lab_payments
          WHERE organization_id = $1 AND location_id = ANY($2) AND received_on BETWEEN $3 AND $4
          GROUP BY 1
       ) x GROUP BY account HAVING SUM(v) <> 0 ORDER BY 2 DESC`,
      [scope.organizationId, scope.locationIds, period.from, period.to],
    );
    return rows.map((x) => ({ account: x.account, amount: r(Number(x.v)) }));
  }

  private async counts(scope: ReportScope, period: Period) {
    const [row] = await sqlRows<Record<string, string>>(
      this.dataSource,
      `SELECT
         (SELECT COUNT(*) FROM invoices
           WHERE organization_id = $1 AND location_id = ANY($2) AND status = 'ISSUED'
             AND issue_date BETWEEN $3 AND $4) AS invoices,
         (SELECT COALESCE(AVG(total_amount) * 100, 0)::bigint FROM invoices
           WHERE organization_id = $1 AND location_id = ANY($2) AND status = 'ISSUED'
             AND issue_date BETWEEN $3 AND $4) AS avg_invoice,
         (SELECT COUNT(DISTINCT patient_id) FROM charges
           WHERE organization_id = $1 AND location_id = ANY($2) AND status = 'ACTIVE'
             AND charge_date BETWEEN $3 AND $4) AS patients,
         (SELECT COUNT(*) FROM payments
           WHERE organization_id = $1 AND location_id = ANY($2)
             AND payment_date BETWEEN $3 AND $4) AS receipts,
         (SELECT COALESCE(SUM(discount_amount) * 100, 0)::bigint FROM charges c
            JOIN invoices i ON i.id = c.invoice_id
           WHERE c.organization_id = $1 AND c.location_id = ANY($2) AND c.status = 'ACTIVE'
             AND i.status = 'ISSUED' AND i.issue_date BETWEEN $3 AND $4) AS discounts`,
      [scope.organizationId, scope.locationIds, period.from, period.to],
    );
    const n = (k: string) => Number(row?.[k] ?? 0);
    return {
      invoices: n('invoices'),
      avgInvoice: r(n('avg_invoice')),
      patientsBilled: n('patients'),
      receipts: n('receipts'),
      discounts: r(n('discounts')),
    };
  }

  /** Things that make the numbers incomplete or double counted. */
  private async warnings(
    scope: ReportScope,
    period: Period,
  ): Promise<string[]> {
    const [row] = await sqlRows<Record<string, string | null>>(
      this.dataSource,
      `SELECT
         (SELECT string_agg(to_char(m, 'Mon YYYY'), ', ' ORDER BY m)
            FROM generate_series($3::date, $4::date, interval '1 month') AS m
           WHERE NOT EXISTS (
                   SELECT 1 FROM payroll_records pr
                    WHERE pr.organization_id = $1 AND pr.location_id = ANY($2)
                      AND make_date(pr.year, pr.month, 1) = m::date)
             AND EXISTS (
                   SELECT 1 FROM payroll_records pr
                    WHERE pr.organization_id = $1 AND pr.location_id = ANY($2)
                      AND make_date(pr.year, pr.month, 1) < m::date)) AS missing_payroll,
         (SELECT COUNT(*) FROM expenses
           WHERE organization_id = $1 AND location_id = ANY($2) AND category = 'SALARY'
             AND expense_date BETWEEN $3 AND $5) AS salary_expenses,
         (SELECT COUNT(*) FROM payroll_records
           WHERE organization_id = $1 AND location_id = ANY($2)
             AND make_date(year, month, 1) BETWEEN $3::date AND $5::date) AS payroll_rows,
         (SELECT COUNT(*) FROM vendor_bills
           WHERE organization_id = $1 AND location_id = ANY($2) AND status = 'draft'
             AND bill_date BETWEEN $3 AND $5) AS draft_bills`,
      [
        scope.organizationId,
        scope.locationIds,
        monthStart(period.from),
        monthStart(period.to),
        period.to,
      ],
    );
    const out: string[] = [];
    if (row?.missing_payroll) {
      out.push(
        `Payroll for ${row.missing_payroll} isn't generated yet, so those salaries are not in these numbers.`,
      );
    }
    if (Number(row?.salary_expenses) > 0 && Number(row?.payroll_rows) > 0) {
      out.push(
        'Salaries are recorded both as payroll and as "Salary" expenses — they may be counted twice.',
      );
    }
    if (Number(row?.draft_bills) > 0) {
      out.push(
        `${row?.draft_bills} lab bill(s) are still drafts and are not counted as cost until approved.`,
      );
    }
    return out;
  }

  private topWithOthers<T extends { amount: number }>(
    sorted: T[],
    others: (rest: number) => T,
  ): T[] {
    const top = sorted.slice(0, TOP_N - 1);
    const rest = sorted.slice(TOP_N - 1).reduce((a, x) => a + x.amount, 0);
    const list = rest ? [...top, others(rest)] : sorted.slice(0, TOP_N);
    return list.map((x) => ({ ...x, amount: r(x.amount) }));
  }
}
