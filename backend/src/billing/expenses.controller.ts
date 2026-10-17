import { Roles } from 'src/common/decorators/roles.decorator';
import { AppRole } from 'src/common/enums/app-role.enum';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseFilterDto,
  ExpenseSummaryQueryDto,
} from './dto/expense.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('expenses')
@RequireFeature('billing.expenses')
@Roles(AppRole.CLINIC_ADMIN, AppRole.RECEPTIONIST)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateExpenseDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.expensesService.create(ctx, dto, req.user?.uuid);
    return ResponseWrapper.success(data, 'Expense recorded successfully');
  }

  @Get()
  async findAll(
    @Query() query: ExpenseFilterDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.expensesService.findAll(ctx, query);
    return ResponseWrapper.success(data);
  }

  @Get('summary')
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
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.expensesService.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Expense updated successfully');
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.expensesService.delete(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Expense deleted successfully');
  }
}
