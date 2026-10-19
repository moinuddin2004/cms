import { Controller, Get, Query } from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { CurrentActor, Roles } from 'src/common/decorators/roles.decorator';
import { Actor, AppRole } from 'src/common/enums/app-role.enum';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { COMMISSIONS_FEATURE } from './commission.enums';
import { CommissionReportsService } from './commission-reports.service';
import { CommissionsQueryDto, EarningsQueryDto } from './dto/compensation.dto';

/** Commission ledger reads (feature billing.commissions). */
@Controller()
@RequireFeature(COMMISSIONS_FEATURE)
export class CommissionsController {
  constructor(private readonly reports: CommissionReportsService) {}

  @Get('commissions')
  @Roles(AppRole.CLINIC_ADMIN)
  async list(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Query() q: CommissionsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.reports.entries(t, a.userId, q),
      'Commission entries fetched',
    );
  }

  @Get('reports/doctor-earnings')
  @Roles(AppRole.CLINIC_ADMIN)
  async doctorEarnings(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Query() q: EarningsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.reports.doctorEarnings(t, a.userId, q),
      'Doctor earnings fetched',
    );
  }

  /** Any actor who can consult; strictly their own assignments. */
  @Get('me/earnings')
  @Roles(AppRole.DOCTOR)
  async myEarnings(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Query() q: EarningsQueryDto,
  ) {
    return ResponseWrapper.success(
      await this.reports.myEarnings(t, a.userId, q),
      'My earnings fetched',
    );
  }
}
