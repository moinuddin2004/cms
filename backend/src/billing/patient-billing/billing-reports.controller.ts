import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import type { AccessContext } from 'src/access/access-context';
import { Access, Can } from 'src/access/decorators/access.decorators';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { BillingActivityService } from '../activity/billing-activity.service';
import { CashCloseService } from '../cash-close/cash-close.service';
import { BillingClock } from '../common/billing-clock.service';
import { billingContext } from '../common/billing-context';
import { DateRangeQueryDto } from '../dto/invoice.dto';
import {
  ActivityQueryDto,
  CreateCashCloseDto,
  OutstandingQueryDto,
  StatementQueryDto,
} from '../dto/report.dto';
import { BillingReportsService } from '../reports/billing-reports.service';
import { PatientBillingService } from './patient-billing.service';

/** Patient billing tab, check-in badges, cash close, reports, activity (7.5). */
@Controller()
export class BillingReportsController {
  constructor(
    private readonly patientBilling: PatientBillingService,
    private readonly cashClose: CashCloseService,
    private readonly reports: BillingReportsService,
    private readonly activity: BillingActivityService,
    private readonly clock: BillingClock,
  ) {}

  @Get('patients/:patientId/billing/summary')
  @Can('billing.invoice.view')
  async summary(
    @ActiveTenant() t: TenantContext,
    @Param('patientId', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.patientBilling.summary(t, id),
      'Billing summary fetched',
    );
  }

  @Get('patients/:patientId/billing/open-charges')
  @Can('billing.invoice.view')
  async openCharges(
    @ActiveTenant() t: TenantContext,
    @Param('patientId', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.patientBilling.openCharges(t, id),
      'Open charges fetched',
    );
  }

  @Get('patients/:patientId/billing/statement')
  @Can('billing.invoice.view')
  async statement(
    @ActiveTenant() t: TenantContext,
    @Param('patientId', ParseUUIDPipe) id: string,
    @Query() q: StatementQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.patientBilling.statement(t, id, q.from, q.to),
      'Statement fetched',
    );
  }

  @Get('billing/outstanding')
  @Can('billing.invoice.view')
  async outstanding(
    @ActiveTenant() t: TenantContext,
    @Query() q: OutstandingQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.patientBilling.outstanding(t, q.patientIds),
      'Outstanding fetched',
    );
  }

  // ─── Cash close (D23) ─────────────────────────────────────────────

  @Get('billing/cash-close/preview')
  @Can('billing.cash_close')
  async cashClosePreview(@ActiveTenant() t: TenantContext) {
    return ResponseWrapper.success(
      await this.cashClose.preview(t),
      'Cash close preview',
    );
  }

  @Post('billing/cash-close')
  @Can('billing.cash_close')
  async createCashClose(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Body() dto: CreateCashCloseDto,
  ) {
    return ResponseWrapper.success(
      await this.cashClose.create(billingContext(t, a), dto),
      'Counter closed',
    );
  }

  @Get('billing/cash-close')
  @Can('billing.cash_close')
  async cashCloseHistory(
    @ActiveTenant() t: TenantContext,
    @Query() q: DateRangeQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.cashClose.history(t, q.from, q.to),
      'Cash closes fetched',
    );
  }

  @Get('billing/cash-close/:id')
  @Can('billing.cash_close')
  async cashCloseDetail(
    @ActiveTenant() t: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.cashClose.detail(t, id),
      'Cash close fetched',
    );
  }

  // ─── Reports ──────────────────────────────────────────────────────

  @Get('billing/reports/doctor-revenue')
  @Can('reports.financial.view')
  async doctorRevenue(
    @ActiveTenant() t: TenantContext,
    @Query() q: DateRangeQueryDto,
  ) {
    const { today } = await this.clock.read(t.locationId);
    return ResponseWrapper.success(
      await this.reports.doctorRevenue(t, q.from ?? today, q.to ?? today),
      'Doctor revenue fetched',
    );
  }

  /** Lives in billing so the treatment-plan module stays free of billing code. */
  @Get('treatment-plans/:planId/billing-summary')
  @Can('billing.invoice.view')
  async planSummary(
    @ActiveTenant() t: TenantContext,
    @Param('planId', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(
      await this.reports.planSummary(t, id),
      'Plan billing summary fetched',
    );
  }

  @Get('billing/activity')
  @Can('billing.activity.view')
  async activityFeed(
    @ActiveTenant() t: TenantContext,
    @Query() q: ActivityQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.activity.list(t, q),
      'Billing activity fetched',
    );
  }
}
