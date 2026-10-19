import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { CurrentActor, Roles } from 'src/common/decorators/roles.decorator';
import { Actor, AppRole } from 'src/common/enums/app-role.enum';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { COMMISSIONS_FEATURE } from './commission.enums';
import { CompensationPlansService } from './compensation-plans.service';
import {
  CompensationPlanDto,
  ReplaceCommissionRulesDto,
} from './dto/compensation.dto';

/** Doctor compensation plans (salary / commission), admin only. */
@Controller()
@RequireFeature(COMMISSIONS_FEATURE)
@Roles(AppRole.CLINIC_ADMIN)
export class CompensationPlansController {
  constructor(private readonly plans: CompensationPlansService) {}

  @Get('assignments/:assignmentId/compensation-plans')
  async list(
    @ActiveTenant() t: TenantContext,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return ResponseWrapper.success(
      await this.plans.list(t, assignmentId),
      'Compensation plans fetched',
    );
  }

  @Post('assignments/:assignmentId/compensation-plans')
  async create(
    @ActiveTenant() t: TenantContext,
    @CurrentActor() a: Actor,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: CompensationPlanDto,
  ) {
    return ResponseWrapper.success(
      await this.plans.create(t, a, assignmentId, dto),
      'Compensation plan saved',
    );
  }

  @Put('compensation-plans/:planId/rules')
  async replaceRules(
    @ActiveTenant() t: TenantContext,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: ReplaceCommissionRulesDto,
  ) {
    return ResponseWrapper.success(
      await this.plans.replaceRules(t, planId, dto),
      'Commission rules saved',
    );
  }
}
