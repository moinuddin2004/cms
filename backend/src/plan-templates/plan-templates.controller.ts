import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import {
  Access,
  AnyMember,
  Can,
} from 'src/access/decorators/access.decorators';
import type { AccessContext } from 'src/access/access-context';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PlanTemplatesService } from './plan-templates.service';
import {
  CreatePlanTemplateDto,
  UpdatePlanTemplateDto,
} from './dto/plan-template.dto';

/** Predefined treatment plans (Root Canal, Implant …) a doctor picks for a patient. */
// Reads are @AnyMember, so the feature check stays at class level.
@RequireFeature('patients.treatment_plans')
@Controller('plan-templates')
export class PlanTemplatesController {
  constructor(private readonly service: PlanTemplatesService) {}

  @Get()
  @AnyMember()
  async findAll(
    @Query('includeInactive') includeInactive: string | undefined,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    const data = await this.service.findAll(
      ctx.organizationId,
      includeInactive === 'true',
    );
    // A fixed discount is money; only price viewers see it. Plans made from
    // the template still get it (applied server-side).
    if (!access.can('patients.price.view')) {
      for (const t of data) {
        t.discountKind = null;
        t.discountValue = null;
      }
    }
    return ResponseWrapper.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Can('plans.templates.manage')
  async create(
    @Body() dto: CreatePlanTemplateDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentUserId() userId: string,
  ) {
    const data = await this.service.create(ctx.organizationId, dto, userId);
    return ResponseWrapper.success(data, 'Treatment plan template created');
  }

  @Patch(':id')
  @Can('plans.templates.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanTemplateDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Treatment plan template updated');
  }

  @Delete(':id')
  @Can('plans.templates.manage')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    await this.service.remove(id, ctx.organizationId);
    return ResponseWrapper.success(null, 'Treatment plan template deleted');
  }
}
