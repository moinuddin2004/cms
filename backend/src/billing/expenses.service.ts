import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PaginatedResponseDto } from 'src/common/dtos/PaginatedResponse.dto';
import { Expense } from './entities/expense.entity';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseFilterDto,
} from './dto/expense.dto';

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
  ) {}

  async create(
    ctx: TenantContext,
    dto: CreateExpenseDto,
    recordedBy: string,
  ): Promise<Expense> {
    const lab = await this.labLink(ctx.organizationId, dto);
    const expense = this.expenseRepo.create({
      ...dto,
      ...lab,
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
      recordedBy,
      expenseDate: new Date(dto.expenseDate),
    });
    return this.expenseRepo.save(expense);
  }

  async findAll(
    ctx: TenantContext,
    filters: ExpenseFilterDto,
  ): Promise<PaginatedResponseDto<Expense>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.recorder', 'recorder')
      .where('e.organization_id = :organizationId', {
        organizationId: ctx.organizationId,
      })
      .andWhere('e.location_id = :locationId', { locationId: ctx.locationId });

    if (filters.category)
      qb.andWhere('e.category = :category', { category: filters.category });
    if (filters.dateFrom)
      qb.andWhere('e.expense_date >= :dateFrom', {
        dateFrom: filters.dateFrom,
      });
    if (filters.dateTo)
      qb.andWhere('e.expense_date <= :dateTo', { dateTo: filters.dateTo });

    qb.orderBy('e.expense_date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return PaginatedResponseDto.create(data, total, page, limit);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateExpenseDto,
  ): Promise<Expense> {
    const expense = await this.expenseRepo.findOne({
      where: { id, organizationId },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    const lab =
      dto.labOrderId !== undefined || dto.labId !== undefined
        ? await this.labLink(organizationId, dto)
        : {};
    Object.assign(expense, {
      ...dto,
      ...lab,
      expenseDate: dto.expenseDate
        ? new Date(dto.expenseDate)
        : expense.expenseDate,
    });
    return this.expenseRepo.save(expense);
  }

  async delete(id: string, organizationId: string): Promise<{ id: string }> {
    const expense = await this.expenseRepo.findOne({
      where: { id, organizationId },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    await this.expenseRepo.remove(expense);
    return { id };
  }

  /**
   * A lab case cost (e.g. the courier, lab ERD §15 step 4): the order must
   * be this clinic's; its lab is filled in from the order.
   */
  private async labLink(
    organizationId: string,
    dto: { labId?: string; labOrderId?: string },
  ): Promise<{ labId: string | null; labOrderId: string | null }> {
    if (!dto.labOrderId) return { labId: dto.labId ?? null, labOrderId: null };
    const rows: Array<{ lab_id: string }> = await this.expenseRepo.query(
      `SELECT lab_id FROM lab_orders WHERE id = $1 AND organization_id = $2`,
      [dto.labOrderId, organizationId],
    );
    if (!rows.length) throw new NotFoundException('Lab order not found');
    return { labId: rows[0].lab_id, labOrderId: dto.labOrderId };
  }

  async getMonthlySummary(
    ctx: TenantContext,
    month: number,
    year: number,
  ): Promise<{
    byCategory: Array<{ category: string; total: number }>;
    grandTotal: number;
  }> {
    const rows = await this.expenseRepo
      .createQueryBuilder('e')
      .select('e.category', 'category')
      .addSelect('COALESCE(SUM(e.amount), 0)', 'total')
      .where('e.organization_id = :organizationId', {
        organizationId: ctx.organizationId,
      })
      .andWhere('e.location_id = :locationId', { locationId: ctx.locationId })
      .andWhere('EXTRACT(MONTH FROM e.expense_date) = :month', { month })
      .andWhere('EXTRACT(YEAR FROM e.expense_date) = :year', { year })
      .groupBy('e.category')
      .getRawMany();

    const byCategory = rows.map((r) => ({
      category: r.category,
      total: num(r.total),
    }));
    const grandTotal = byCategory.reduce((s, c) => s + c.total, 0);
    return { byCategory, grandTotal };
  }
}
