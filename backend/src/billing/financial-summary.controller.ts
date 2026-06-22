import { Controller, Get, Query } from '@nestjs/common';
import { FinancialSummaryService } from './financial-summary.service';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('financial-summary')
@RequireFeature('billing.financial_summary')
export class FinancialSummaryController {
  constructor(
    private readonly financialSummaryService: FinancialSummaryService,
  ) {}

  @Get('daily')
  async daily(
    @Query('date') date: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const target = date || new Date().toISOString().slice(0, 10);
    const data = await this.financialSummaryService.getDailySummary(
      ctx,
      target,
    );
    return ResponseWrapper.success(data);
  }

  @Get('monthly')
  async monthly(
    @Query('month') month: string,
    @Query('year') year: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const now = new Date();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const data = await this.financialSummaryService.getMonthlySummary(
      ctx,
      m,
      y,
    );
    return ResponseWrapper.success(data);
  }

  @Get('trend')
  async trend(
    @Query('months') months: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const n = months ? parseInt(months, 10) : 6;
    const data = await this.financialSummaryService.getRevenueComparison(
      ctx,
      n,
    );
    return ResponseWrapper.success(data);
  }
}
