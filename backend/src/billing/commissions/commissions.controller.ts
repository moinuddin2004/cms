import { Controller, Get, Query } from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import type { AccessContext } from 'src/access/access-context';
import { Access, Can } from 'src/access/decorators/access.decorators';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { CommissionReportsService } from './commission-reports.service';
import { CommissionsQueryDto, EarningsQueryDto } from './dto/compensation.dto';

/** Commission ledger reads (feature billing.commissions). */
@Controller()
export class CommissionsController {
  constructor(private readonly reports: CommissionReportsService) {}

  @Get('commissions')
  @Can('earnings.all.view')
  async list(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Query() q: CommissionsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.reports.entries(t, a.userId, q),
      'Commission entries fetched',
    );
  }

  @Get('reports/doctor-earnings')
  @Can('earnings.all.view')
  async doctorEarnings(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Query() q: EarningsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.reports.doctorEarnings(t, a.userId, q),
      'Doctor earnings fetched',
    );
  }

  /** Strictly the caller's own assignments. */
  @Get('me/earnings')
  @Can('earnings.own.view')
  async myEarnings(
    @ActiveTenant() t: TenantContext,
    @Access() a: AccessContext,
    @Query() q: EarningsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.reports.myEarnings(t, a.userId, q),
      'My earnings fetched',
    );
  }
}
