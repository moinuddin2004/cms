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
import { PrescriptionTemplateService } from '../services/prescription-template.service';
import {
  CreatePrescriptionTemplateDto,
  UpdatePrescriptionTemplateDto,
} from '../dto/prescription-template.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@RequireFeature('patients.prescriptions')
@Controller('prescription-templates')
export class PrescriptionTemplateController {
  constructor(
    private readonly service: PrescriptionTemplateService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePrescriptionTemplateDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.service.create(
      ctx.organizationId,
      dto,
      req.user?.uuid ?? null,
    );
    return ResponseWrapper.success(data, 'Prescription template created');
  }

  @Get()
  async findAll(
    @Query('locationId') locationId: string | undefined,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.findAll(ctx.organizationId, locationId);
    return ResponseWrapper.success(data);
  }

  @Get('default')
  async getDefault(
    @Query('locationId') locationId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const useLoc = locationId || ctx.locationId;
    const data = await this.service.getDefaultForLocation(
      ctx.organizationId,
      useLoc,
    );
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
    @Body() dto: UpdatePrescriptionTemplateDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Prescription template updated');
  }

  @Delete(':id')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.deactivate(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Prescription template deactivated');
  }
}
