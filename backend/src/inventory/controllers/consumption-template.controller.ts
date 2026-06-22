import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConsumptionTemplateService } from '../services/consumption-template.service';
import {
  CreateConsumptionTemplateDto,
  UpdateConsumptionTemplateDto,
} from '../dto/consumption-template.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('consumption-templates')
@RequireFeature('inventory.core')
export class ConsumptionTemplateController {
  constructor(private readonly templateService: ConsumptionTemplateService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateConsumptionTemplateDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.templateService.create(ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Template created successfully');
  }

  @Get()
  async findAll(@ActiveTenant() ctx: TenantContext) {
    const data = await this.templateService.findAll(ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Get('by-type')
  async findByAppointmentType(
    @Query('appointmentType') appointmentType: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.templateService.findByAppointmentType(
      ctx.organizationId,
      appointmentType,
    );
    return ResponseWrapper.success(data);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.templateService.findOne(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConsumptionTemplateDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.templateService.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Template updated successfully');
  }

  @Delete(':id')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.templateService.deactivate(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Template deactivated successfully');
  }
}
