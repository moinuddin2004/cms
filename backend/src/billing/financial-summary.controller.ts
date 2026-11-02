import { Controller, Get, Query } from '@nestjs/common';
import { Can } from 'src/access/decorators/access.decorators';
import { FinancialSummaryService } from './financial-summary.service';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { BillingClock } from './common/billing-clock.service';

/** No permission belongs to `billing.financial_summary`, so the feature stays checked. */
@Controller('financial-summary')
@RequireFeature('billing.financial_summary')
@Can('reports.financial.view')
export class FinancialSummaryController {
  constructor(
    private readonly financialSummaryService: FinancialSummaryService,
    private readonly clinicClock: BillingClock,
  ) {}

  @Get('daily')
  async daily(@Query('date') date: string, @ActiveTenant() ctx: TenantContext) {
    const target =
      date || (await this.clinicClock.read(ctx.locationId)).today;
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
    // Default to the LOCATION's current month, not the server's.
    const { today } = await this.clinicClock.read(ctx.locationId);
    const m = month ? parseInt(month, 10) : Number(today.slice(5, 7));
    const y = year ? parseInt(year, 10) : Number(today.slice(0, 4));
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
