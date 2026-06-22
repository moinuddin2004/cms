import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Invoice } from './entities/invoice.entity';
import { Payment } from './entities/payment.entity';
import { Expense } from './entities/expense.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InvoiceStatus } from './enums/billing.enums';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
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
    @InjectRepository(InvoiceItem)
    private readonly itemRepo: Repository<InvoiceItem>,
  ) {}

  async getDailySummary(ctx: TenantContext, date: string) {
    const { organizationId, locationId } = ctx;

    const methodRows = await this.paymentRepo
      .createQueryBuilder('p')
      .select('p.payment_method', 'method')
      .addSelect('COALESCE(SUM(p.amount),0)', 'sum')
      .where('p.organization_id = :organizationId', { organizationId })
      .andWhere('p.location_id = :locationId', { locationId })
      .andWhere('p.payment_date = :date', { date })
      .groupBy('p.payment_method')
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
      .andWhere('i.issued_date = :date', { date })
      .getCount();

    const outstandingRow = await this.invoiceRepo
      .createQueryBuilder('i')
      .select('COALESCE(SUM(i.balance_due),0)', 'sum')
      .where('i.organization_id = :organizationId', { organizationId })
      .andWhere('i.location_id = :locationId', { locationId })
      .andWhere('i.status IN (:...statuses)', {
        statuses: [
          InvoiceStatus.PENDING,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.OVERDUE,
        ],
      })
      .getRawOne();

    const overdueCount = await this.invoiceRepo.count({
      where: { organizationId, locationId, status: InvoiceStatus.OVERDUE },
    });

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
    const totalRevenue = num(revenueRow?.sum);

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
      .andWhere('EXTRACT(MONTH FROM i.issued_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM i.issued_date) = :year', { year })
      .getRawOne();

    const paidInvoiceCount = await this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.organization_id = :organizationId', { organizationId })
      .andWhere('i.location_id = :locationId', { locationId })
      .andWhere('i.status = :status', { status: InvoiceStatus.PAID })
      .andWhere('EXTRACT(MONTH FROM i.issued_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM i.issued_date) = :year', { year })
      .getCount();

    const overdueInvoiceCount = await this.invoiceRepo.count({
      where: { organizationId, locationId, status: InvoiceStatus.OVERDUE },
    });

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
      .select('p.payment_method', 'method')
      .addSelect('COALESCE(SUM(p.amount),0)', 'amount')
      .where('p.organization_id = :organizationId', { organizationId })
      .andWhere('p.location_id = :locationId', { locationId })
      .andWhere('EXTRACT(MONTH FROM p.payment_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM p.payment_date) = :year', { year })
      .groupBy('p.payment_method')
      .getRawMany();

    const topProcedureRows = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.invoice', 'i')
      .select('item.description', 'name')
      .addSelect('SUM(item.quantity)', 'count')
      .addSelect('COALESCE(SUM(item.total_price),0)', 'revenue')
      .where('i.organization_id = :organizationId', { organizationId })
      .andWhere('i.location_id = :locationId', { locationId })
      .andWhere('EXTRACT(MONTH FROM i.issued_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM i.issued_date) = :year', { year })
      .groupBy('item.description')
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

    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

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

      result.push({
        month: `${MONTH_NAMES[d.getMonth()]} ${y}`,
        revenue: num(revRow?.sum),
        expenses: num(expRow?.sum),
      });
    }
    return result;
  }
}
