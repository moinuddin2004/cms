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
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { PlanTemplatesService } from './plan-templates.service';
import {
  CreatePlanTemplateDto,
  UpdatePlanTemplateDto,
} from './dto/plan-template.dto';

/** Predefined treatment plans (Root Canal, Implant …) a doctor picks for a patient. */
@RequireFeature('patients.treatment_plans')
@Controller('plan-templates')
export class PlanTemplatesController {
  constructor(private readonly service: PlanTemplatesService) {}

  @Get()
  async findAll(
    @Query('includeInactive') includeInactive: string | undefined,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.findAll(
      ctx.organizationId,
      includeInactive === 'true',
    );
    return ResponseWrapper.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePlanTemplateDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentUserId() userId: string,
  ) {
    const data = await this.service.create(ctx.organizationId, dto, userId);
    return ResponseWrapper.success(data, 'Treatment plan template created');
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanTemplateDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Treatment plan template updated');
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    await this.service.remove(id, ctx.organizationId);
    return ResponseWrapper.success(null, 'Treatment plan template deleted');
  }
}
