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
import type { AccessContext } from 'src/access/access-context';
import { Access, Can } from 'src/access/decorators/access.decorators';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { CompensationPlansService } from './compensation-plans.service';
import {
  CompensationPlanDto,
  ReplaceCommissionRulesDto,
} from './dto/compensation.dto';

/** Doctor compensation plans (salary / commission). */
@Controller()
@Can('compensation.manage')
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
    @Access() a: AccessContext,
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
