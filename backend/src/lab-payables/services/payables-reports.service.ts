import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ClockService } from 'src/common/clock/clock.service';
import { sqlRows } from 'src/common/database/sql';
import {
  AGING_BUCKETS,
  AgingBucket,
  agingBucket,
  daysBetween,
} from '../common/payables-math';
import {
  AgingQueryDto,
  CaseProfitQueryDto,
  MonthlyCostQueryDto,
} from '../dto/payables.dto';

type Buckets = Record<AgingBucket, number>;
const emptyBuckets = (): Buckets =>
  Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Buckets;

/**
 * Payables reports (lab ERD §15): what is owed to each lab by age, monthly
 * lab cost per lab, and case profit from the order snapshots. Invoiced,
 * collected, receivable and payable stay separate numbers.
 */
@Injectable()
export class PayablesReportsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: ClockService,
  ) {}

  /** Open balances of approved bills, bucketed by days past due (bill date when no due date). */
  async aging(organizationId: string, locationId: string, q: AgingQueryDto) {
    const tz = await this.clock.timezoneFor(locationId);
    const today = this.clock.today(tz);
    const rows = await sqlRows<{
      lab_id: string;
      lab_name: string;
      due: string;
      balance_minor: string;
    }>(
      this.dataSource,
      `SELECT b.lab_id, l.name AS lab_name, to_char(COALESCE(b.due_on, b.bill_date), 'YYYY-MM-DD') AS due,
              b.balance_minor
         FROM vendor_bills b JOIN labs l ON l.id = b.lab_id
        WHERE b.organization_id = $1 AND b.status IN ('approved', 'partially_paid')
          AND b.balance_minor > 0 AND ($2::uuid IS NULL OR b.lab_id = $2)`,
      [organizationId, q.labId ?? null],
    );
    const byLab = new Map<
      string,
      {
        labId: string;
        labName: string;
        buckets: Buckets;
        totalMinor: number;
        bills: number;
      }
    >();
    const totals = emptyBuckets();
    for (const r of rows) {
      const lab = byLab.get(r.lab_id) ?? {
        labId: r.lab_id,
        labName: r.lab_name,
        buckets: emptyBuckets(),
        totalMinor: 0,
        bills: 0,
      };
      const bucket = agingBucket(daysBetween(r.due, today));
      const amount = Number(r.balance_minor);
      lab.buckets[bucket] += amount;
      lab.totalMinor += amount;
      lab.bills += 1;
      totals[bucket] += amount;
      byLab.set(r.lab_id, lab);
    }
    const labs = [...byLab.values()].sort(
      (a, b) => b.totalMinor - a.totalMinor,
    );
    return {
      asOf: today,
      labs,
      totals: {
        buckets: totals,
        totalMinor: labs.reduce((a, l) => a + l.totalMinor, 0),
      },
    };
  }

  /** Approved lab cost (Σ approved bills by bill month) per lab, plus what was paid. */
  async monthlyCost(organizationId: string, q: MonthlyCostQueryDto) {
    const rows = await sqlRows<{
      lab_id: string;
      lab_name: string;
      month: number;
      cost_minor: string;
      bills: number;
    }>(
      this.dataSource,
      `SELECT b.lab_id, l.name AS lab_name, EXTRACT(MONTH FROM b.bill_date)::int AS month,
              SUM(b.total_minor) AS cost_minor, count(*)::int AS bills
         FROM vendor_bills b JOIN labs l ON l.id = b.lab_id
        WHERE b.organization_id = $1 AND b.status IN ('approved', 'partially_paid', 'paid')
          AND EXTRACT(YEAR FROM b.bill_date) = $2
        GROUP BY b.lab_id, l.name, month ORDER BY l.name, month`,
      [organizationId, q.year],
    );
    const labs = new Map<
      string,
      { labId: string; labName: string; months: number[]; totalMinor: number }
    >();
    for (const r of rows) {
      const lab = labs.get(r.lab_id) ?? {
        labId: r.lab_id,
        labName: r.lab_name,
        months: Array<number>(12).fill(0),
        totalMinor: 0,
      };
      lab.months[r.month - 1] += Number(r.cost_minor);
      lab.totalMinor += Number(r.cost_minor);
      labs.set(r.lab_id, lab);
    }
    const list = [...labs.values()];
    const months = Array<number>(12).fill(0);
    for (const l of list) l.months.forEach((v, i) => (months[i] += v));
    return {
      year: q.year,
      labs: list,
      totals: { months, totalMinor: months.reduce((a, v) => a + v, 0) },
    };
  }

  /**
   * Case profit per submitted order (lab ERD §15 formula):
   * revenue − lab cost − case expenses − doctor commission. Revenue is what
   * the patient was invoiced for the case (issued lab invoices net of credit
   * notes), or the frozen patient price while nothing is invoiced. Lab cost =
   * the items' frozen lab cost + approved order-level charges (what the lab
   * is owed); `billed` shows what the vendor bills say. Commission = lab
   * commission entries on the order's invoice lines (signed, so reversals
   * net out). Invoiced and collected are shown apart (§15).
   */
  async caseProfit(
    organizationId: string,
    locationId: string,
    q: CaseProfitQueryDto,
  ) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    // Org-wide list; from/to are read as days in the ACTIVE location's tz.
    const tz = await this.clock.timezoneFor(locationId);
    const params = [
      organizationId,
      q.labId ?? null,
      q.from ?? null,
      q.to ?? null,
      tz,
    ];
    const where = `o.organization_id = $1 AND o.order_no IS NOT NULL
      AND ($2::uuid IS NULL OR o.lab_id = $2)
      AND ($3::date IS NULL OR (o.submitted_at AT TIME ZONE $5)::date >= $3)
      AND ($4::date IS NULL OR (o.submitted_at AT TIME ZONE $5)::date <= $4)`;
    const [{ n }] = await sqlRows<{ n: number }>(
      this.dataSource,
      `SELECT count(*)::int AS n FROM lab_orders o WHERE ${where}`,
      params,
    );
    const rows = await sqlRows<{
      id: string;
      order_no: string;
      status_code: string;
      submitted_at: Date;
      lab_name: string;
      patient_name: string | null;
      patient_minor: string;
      lab_minor: string;
      charges_minor: string;
      billed_minor: string;
      expense_minor: string;
      invoiced_minor: string | null;
      collected_minor: string;
      commission_minor: string;
    }>(
      this.dataSource,
      `SELECT o.id, o.order_no, o.status_code, o.submitted_at, l.name AS lab_name, p.full_name AS patient_name,
              COALESCE((SELECT SUM(i.patient_line_price_minor) FROM lab_order_items i
                         WHERE i.order_id = o.id AND i.status_code IS DISTINCT FROM 'cancelled'), 0) AS patient_minor,
              COALESCE((SELECT SUM(i.lab_line_cost_minor) FROM lab_order_items i
                         WHERE i.order_id = o.id AND i.status_code IS DISTINCT FROM 'cancelled'), 0) AS lab_minor,
              COALESCE((SELECT SUM(c.amount_minor) FROM order_charge_requests c
                         WHERE c.order_id = o.id AND c.item_id IS NULL AND c.status = 'approved'), 0) AS charges_minor,
              COALESCE((SELECT SUM(b.total_minor) FROM vendor_bills b
                         WHERE b.lab_order_id = o.id AND b.status IN ('approved', 'partially_paid', 'paid')), 0) AS billed_minor,
              COALESCE((SELECT (SUM(e.amount) * 100)::bigint FROM expenses e
                         WHERE e.lab_order_id = o.id), 0) AS expense_minor,
              (SELECT SUM(li.total_minor - li.credited_minor) FROM lab_invoices li
                WHERE li.order_id = o.id AND li.status NOT IN ('draft', 'void')) AS invoiced_minor,
              COALESCE((SELECT SUM(li.paid_minor) FROM lab_invoices li
                         WHERE li.order_id = o.id AND li.status NOT IN ('draft', 'void')), 0) AS collected_minor,
              COALESCE((SELECT SUM(ce.amount_minor) FROM commission_entries ce
                          JOIN lab_invoice_lines ll ON ll.id = ce.lab_invoice_line_id
                          JOIN lab_invoices li ON li.id = ll.invoice_id
                         WHERE li.order_id = o.id), 0) AS commission_minor
         FROM lab_orders o JOIN labs l ON l.id = o.lab_id
         LEFT JOIN patients p ON p.id = o.patient_id
        WHERE ${where}
        ORDER BY o.submitted_at DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params,
    );
    const data = rows.map((r) => {
      const patientPriceMinor = Number(r.patient_minor);
      const labCostMinor = Number(r.lab_minor) + Number(r.charges_minor);
      const expensesMinor = Number(r.expense_minor);
      const invoicedMinor =
        r.invoiced_minor === null ? null : Number(r.invoiced_minor);
      const commissionMinor = Number(r.commission_minor);
      const revenueMinor = invoicedMinor ?? patientPriceMinor;
      return {
        orderId: r.id,
        orderNo: r.order_no,
        status: r.status_code,
        submittedAt: r.submitted_at,
        labName: r.lab_name,
        patientName: r.patient_name,
        patientPriceMinor,
        labCostMinor,
        billedLabCostMinor: Number(r.billed_minor),
        expensesMinor,
        invoicedMinor,
        collectedMinor: Number(r.collected_minor),
        commissionMinor,
        profitMinor:
          revenueMinor - labCostMinor - expensesMinor - commissionMinor,
      };
    });
    return {
      data,
      total: n,
      page,
      limit,
      totalPages: Math.ceil(n / limit),
    };
  }
}

/**
 * Lab cost of order items for other modules (lab ERD §6c commission
 * `net_of_lab_cost`; Sprint 9's lab invoices): what approved vendor bills
 * say for the item, else its frozen snapshot.
 */
@Injectable()
export class LabCaseCostService {
  async forItems(
    m: EntityManager,
    itemIds: string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!itemIds.length) return out;
    const rows = await sqlRows<{
      id: string;
      snapshot: string;
      billed: string | null;
    }>(
      m,
      `SELECT i.id, i.lab_line_cost_minor AS snapshot,
              (SELECT SUM(l.line_total_minor) FROM vendor_bill_lines l
                 JOIN vendor_bills b ON b.id = l.vendor_bill_id
                WHERE l.order_item_id = i.id AND b.status IN ('approved', 'partially_paid', 'paid')) AS billed
         FROM lab_order_items i WHERE i.id = ANY($1::uuid[])`,
      [itemIds],
    );
    for (const r of rows) out.set(r.id, Number(r.billed ?? r.snapshot));
    return out;
  }
}
