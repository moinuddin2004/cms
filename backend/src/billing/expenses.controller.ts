import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { AccessContext } from 'src/access/access-context';
import { Access, Can } from 'src/access/decorators/access.decorators';
import { ExpensesService } from './expenses.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseFilterDto,
  ExpenseSummaryQueryDto,
} from './dto/expense.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @Can('expenses.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateExpenseDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() a: AccessContext,
  ) {
    const data = await this.expensesService.create(ctx, dto, a.userId);
    return ResponseWrapper.success(data, 'Expense recorded successfully');
  }

  @Get()
  @Can('expenses.view')
  async findAll(
    @Query() query: ExpenseFilterDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.expensesService.findAll(ctx, query);
    return ResponseWrapper.success(data);
  }

  @Get('summary')
  @Can('expenses.view')
  async summary(
    @Query() query: ExpenseSummaryQueryDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.expensesService.getMonthlySummary(
      ctx,
      query.month,
      query.year,
    );
    return ResponseWrapper.success(data);
  }

  @Patch(':id')
  @Can('expenses.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.expensesService.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Expense updated successfully');
  }

  @Delete(':id')
  @Can('expenses.manage')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.expensesService.delete(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Expense deleted successfully');
  }
}
