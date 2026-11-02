import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Invoice } from './entities/invoice.entity';
import { Payment } from './entities/payment.entity';
import { Expense } from './entities/expense.entity';
import { Charge } from './entities/charge.entity';
import { Refund } from './entities/refund.entity';
import { preTaxAllocationSql } from './tax/invoice-tax';
import { BillingClock } from './common/billing-clock.service';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

@Injectable()
export class FinancialSummaryService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(Charge)
    private readonly chargeRepo: Repository<Charge>,
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
    private readonly clinicClock: BillingClock,
  ) {}

  async getDailySummary(ctx: TenantContext, date: string) {
    const { organizationId, locationId } = ctx;

    const methodRows = await this.paymentRepo
      .createQueryBuilder('p')
      .select('p.payment_account_name', 'method')
      .addSelect('COALESCE(SUM(p.amount),0)', 'sum')
      .where('p.organization_id = :organizationId', { organizationId })
      .andWhere('p.location_id = :locationId', { locationId })
      .andWhere('p.payment_date = :date', { date })
      .groupBy('p.payment_account_name')
      .getRawMany();

    const paymentMethodBreakdown: Record<string, number> = {};
    let totalCollections = 0;
    for (const r of methodRows) {
      paymentMethodBreakdown[r.method] = num(r.sum);
      totalCollections += num(r.sum);
    }

    const invoicesGenerated = await this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.organization_id = :organizationId', { organizationId })
      .andWhere('i.location_id = :locationId', { locationId })
      .andWhere('i.issue_date = :date', { date })
      .andWhere(`i.status = 'ISSUED'`)
      .getCount();

    const refundRow = await this.refundRepo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.amount),0)', 'sum')
      .where('r.organization_id = :organizationId', { organizationId })
      .andWhere('r.location_id = :locationId', { locationId })
      .andWhere('r.refund_date = :date', { date })
      .getRawOne();
    totalCollections -= num(refundRow?.sum);

    const outstandingRow = await this.invoiceRepo
      .createQueryBuilder('i')
      .select('COALESCE(SUM(i.balance_due),0)', 'sum')
      .where('i.organization_id = :organizationId', { organizationId })
      .andWhere('i.location_id = :locationId', { locationId })
      .andWhere(`i.status = 'ISSUED'`)
      .getRawOne();

    const overdueCount = await this.overdueCount(
      organizationId,
      locationId,
      date,
    );

    return {
      totalCollections: round2(totalCollections),
      invoicesGenerated,
      paymentMethodBreakdown,
      outstandingAmount: num(outstandingRow?.sum),
      overdueCount,
    };
  }

  async getMonthlySummary(ctx: TenantContext, month: number, year: number) {
    const { organizationId, locationId } = ctx;

    const revenueRow = await this.paymentRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount),0)', 'sum')
      .where('p.organization_id = :organizationId', { organizationId })
      .andWhere('p.location_id = :locationId', { locationId })
      .andWhere('EXTRACT(MONTH FROM p.payment_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM p.payment_date) = :year', { year })
      .getRawOne();
    const refundMonthRow = await this.refundRepo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.amount),0)', 'sum')
      .where('r.organization_id = :organizationId', { organizationId })
      .andWhere('r.location_id = :locationId', { locationId })
      .andWhere('EXTRACT(MONTH FROM r.refund_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM r.refund_date) = :year', { year })
      .getRawOne();
    const taxCollected = await this.taxCollected(
      organizationId,
      locationId,
      month,
      year,
    );
    // Sales tax collected on patient invoices is not revenue.
    const totalRevenue = round2(
      num(revenueRow?.sum) - num(refundMonthRow?.sum) - taxCollected,
    );

    const expenseRow = await this.expenseRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount),0)', 'sum')
      .where('e.organization_id = :organizationId', { organizationId })
      .andWhere('e.location_id = :locationId', { locationId })
      .andWhere('EXTRACT(MONTH FROM e.expense_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM e.expense_date) = :year', { year })
      .getRawOne();
    const totalExpenses = num(expenseRow?.sum);

    const invoiceAggRow = await this.invoiceRepo
      .createQueryBuilder('i')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(AVG(i.total_amount),0)', 'avg')
      .where('i.organization_id = :organizationId', { organizationId })
      .andWhere('i.location_id = :locationId', { locationId })
      .andWhere(`i.status = 'ISSUED'`)
      .andWhere('EXTRACT(MONTH FROM i.issue_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM i.issue_date) = :year', { year })
      .getRawOne();

    const paidInvoiceCount = await this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.organization_id = :organizationId', { organizationId })
      .andWhere('i.location_id = :locationId', { locationId })
      .andWhere(`i.status = 'ISSUED' AND i.balance_due <= 0`)
      .andWhere('EXTRACT(MONTH FROM i.issue_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM i.issue_date) = :year', { year })
      .getCount();

    const overdueInvoiceCount = await this.overdueCount(
      organizationId,
      locationId,
      (await this.clinicClock.read(locationId)).today,
    );

    const revenueByDayRows = await this.paymentRepo
      .createQueryBuilder('p')
      .select('p.payment_date', 'date')
      .addSelect('COALESCE(SUM(p.amount),0)', 'amount')
      .where('p.organization_id = :organizationId', { organizationId })
      .andWhere('p.location_id = :locationId', { locationId })
      .andWhere('EXTRACT(MONTH FROM p.payment_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM p.payment_date) = :year', { year })
      .groupBy('p.payment_date')
      .orderBy('p.payment_date', 'ASC')
      .getRawMany();

    const expenseCatRows = await this.expenseRepo
      .createQueryBuilder('e')
      .select('e.category', 'category')
      .addSelect('COALESCE(SUM(e.amount),0)', 'amount')
      .where('e.organization_id = :organizationId', { organizationId })
      .andWhere('e.location_id = :locationId', { locationId })
      .andWhere('EXTRACT(MONTH FROM e.expense_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM e.expense_date) = :year', { year })
      .groupBy('e.category')
      .getRawMany();

    const methodRows = await this.paymentRepo
      .createQueryBuilder('p')
      .select('p.payment_account_name', 'method')
      .addSelect('COALESCE(SUM(p.amount),0)', 'amount')
      .where('p.organization_id = :organizationId', { organizationId })
      .andWhere('p.location_id = :locationId', { locationId })
      .andWhere('EXTRACT(MONTH FROM p.payment_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM p.payment_date) = :year', { year })
      .groupBy('p.payment_account_name')
      .getRawMany();

    const topProcedureRows = await this.chargeRepo
      .createQueryBuilder('c')
      .innerJoin('c.invoice', 'i')
      .select('c.description', 'name')
      .addSelect('SUM(c.quantity)', 'count')
      .addSelect('COALESCE(SUM(c.net_amount),0)', 'revenue')
      .where('i.organization_id = :organizationId', { organizationId })
      .andWhere('i.location_id = :locationId', { locationId })
      .andWhere(`i.status = 'ISSUED' AND c.status = 'ACTIVE'`)
      .andWhere('EXTRACT(MONTH FROM i.issue_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM i.issue_date) = :year', { year })
      .groupBy('c.description')
      .orderBy('revenue', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      totalRevenue,
      totalExpenses,
      netProfit: round2(totalRevenue - totalExpenses),
      invoiceCount: num(invoiceAggRow?.count),
      paidInvoiceCount,
      overdueInvoiceCount,
      avgInvoiceValue: round2(num(invoiceAggRow?.avg)),
      revenueByDay: revenueByDayRows.map((r) => ({
        date: r.date,
        amount: num(r.amount),
      })),
      expensesByCategory: expenseCatRows.map((r) => ({
        category: r.category,
        amount: num(r.amount),
      })),
      paymentMethodDistribution: methodRows.map((r) => ({
        method: r.method,
        amount: num(r.amount),
      })),
      topProcedures: topProcedureRows.map((r) => ({
        name: r.name,
        count: num(r.count),
        revenue: num(r.revenue),
      })),
    };
  }

  async getRevenueComparison(ctx: TenantContext, months: number) {
    const { organizationId, locationId } = ctx;
    const result: Array<{ month: string; revenue: number; expenses: number }> =
      [];

    // Months are counted back from the LOCATION's current month.
    const { today } = await this.clinicClock.read(locationId);
    const curY = Number(today.slice(0, 4));
    const curM = Number(today.slice(5, 7)); // 1-12
    for (let i = months - 1; i >= 0; i--) {
      const idx = curY * 12 + (curM - 1) - i;
      const y = Math.floor(idx / 12);
      const m = (idx % 12) + 1;

      const revRow = await this.paymentRepo
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount),0)', 'sum')
        .where('p.organization_id = :organizationId', { organizationId })
        .andWhere('p.location_id = :locationId', { locationId })
        .andWhere('EXTRACT(MONTH FROM p.payment_date) = :m', { m })
        .andWhere('EXTRACT(YEAR FROM p.payment_date) = :y', { y })
        .getRawOne();

      const expRow = await this.expenseRepo
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.amount),0)', 'sum')
        .where('e.organization_id = :organizationId', { organizationId })
        .andWhere('e.location_id = :locationId', { locationId })
        .andWhere('EXTRACT(MONTH FROM e.expense_date) = :m', { m })
        .andWhere('EXTRACT(YEAR FROM e.expense_date) = :y', { y })
        .getRawOne();

      const refRow = await this.refundRepo
        .createQueryBuilder('r')
        .select('COALESCE(SUM(r.amount),0)', 'sum')
        .where('r.organization_id = :organizationId', { organizationId })
        .andWhere('r.location_id = :locationId', { locationId })
        .andWhere('EXTRACT(MONTH FROM r.refund_date) = :m', { m })
        .andWhere('EXTRACT(YEAR FROM r.refund_date) = :y', { y })
        .getRawOne();

      const tax = await this.taxCollected(organizationId, locationId, m, y);
      result.push({
        month: `${MONTH_NAMES[m - 1]} ${y}`,
        revenue: round2(num(revRow?.sum) - num(refRow?.sum) - tax),
        expenses: num(expRow?.sum),
      });
    }
    return result;
  }

  /** Overdue is computed (D16): issued, unpaid balance, past due. */
  private overdueCount(
    organizationId: string,
    locationId: string,
    today: string,
  ): Promise<number> {
    return this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.organization_id = :organizationId', { organizationId })
      .andWhere('i.location_id = :locationId', { locationId })
      .andWhere(
        `i.status = 'ISSUED' AND i.balance_due > 0 AND i.due_date < :today`,
        { today },
      )
      .getCount();
  }

  /**
   * Tax part of the money allocated to taxed charges from payments dated in
   * the month (allocations cover net and tax pro rata).
   */
  private async taxCollected(
    organizationId: string,
    locationId: string,
    month: number,
    year: number,
  ): Promise<number> {
    const [row]: Array<{ sum: string }> = await this.paymentRepo.query(
      `SELECT COALESCE(SUM(pa.amount - ${preTaxAllocationSql('pa', 'c')}), 0) AS sum
         FROM payment_allocations pa
         JOIN payments p ON p.id = pa.payment_id
         JOIN charges c ON c.id = pa.charge_id
        WHERE p.organization_id = $1 AND p.location_id = $2 AND c.tax_amount > 0
          AND EXTRACT(MONTH FROM p.payment_date) = $3
          AND EXTRACT(YEAR FROM p.payment_date) = $4`,
      [organizationId, locationId, month, year],
    );
    return num(row?.sum);
  }
}
