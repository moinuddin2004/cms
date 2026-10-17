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
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { CurrentActor, Roles } from 'src/common/decorators/roles.decorator';
import { Actor, AppRole } from 'src/common/enums/app-role.enum';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { BillingActivityService } from '../activity/billing-activity.service';
import { BILLING_FEATURE } from '../billing.constants';
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
@RequireFeature(BILLING_FEATURE)
@Roles(AppRole.CLINIC_ADMIN, AppRole.RECEPTIONIST)
export class BillingReportsController {
  constructor(
    private readonly patientBilling: PatientBillingService,
    private readonly cashClose: CashCloseService,
    private readonly reports: BillingReportsService,
    private readonly activity: BillingActivityService,
    private readonly clock: BillingClock,
  ) {}

  @Get('patients/:patientId/billing/summary')
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
  async cashClosePreview(@ActiveTenant() t: TenantContext) {
    return ResponseWrapper.success(
      await this.cashClose.preview(t),
      'Cash close preview',
    );
  }

  @Post('billing/cash-close')
  async createCashClose(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Body() dto: CreateCashCloseDto,
  ) {
    return ResponseWrapper.success(
      await this.cashClose.create(billingContext(t, a), dto),
      'Counter closed',
    );
  }

  @Get('billing/cash-close')
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
  @Roles(AppRole.CLINIC_ADMIN)
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
  @Roles(AppRole.CLINIC_ADMIN)
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
