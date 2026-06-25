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
  Req,
} from '@nestjs/common';
import { TreatmentPlanTemplateService } from '../services/treatment-plan-template.service';
import {
  CreateTreatmentPlanTemplateDto,
  UpdateTreatmentPlanTemplateDto,
} from '../dto/treatment-plan-template.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@RequireFeature('patients.prescriptions')
@Controller('treatment-plan-templates')
export class TreatmentPlanTemplateController {
  constructor(
    private readonly service: TreatmentPlanTemplateService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateTreatmentPlanTemplateDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.service.create(
      ctx.organizationId,
      dto,
      req.user?.uuid ?? null,
    );
    return ResponseWrapper.success(data, 'Treatment plan template created');
  }

  @Get()
  async findAll(
    @Query('category') category: string | undefined,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.findAll(ctx.organizationId, category);
    return ResponseWrapper.success(data);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.findOne(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTreatmentPlanTemplateDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Treatment plan template updated');
  }

  @Delete(':id')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.deactivate(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Treatment plan template deactivated');
  }
}
