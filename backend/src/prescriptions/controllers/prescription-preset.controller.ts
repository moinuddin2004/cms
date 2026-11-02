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
import { PrescriptionPresetService } from '../services/prescription-preset.service';
import {
  CreatePrescriptionPresetDto,
  UpdatePrescriptionPresetDto,
} from '../dto/prescription-preset.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { AnyMember, Can } from 'src/access/decorators/access.decorators';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

// Reads are @AnyMember, so the feature check stays at class level.
@RequireFeature('patients.prescriptions')
@Controller('prescription-presets')
export class PrescriptionPresetController {
  constructor(private readonly service: PrescriptionPresetService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Can('prescriptions.library.manage')
  async create(
    @Body() dto: CreatePrescriptionPresetDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.service.create(
      ctx.organizationId,
      dto,
      req.user?.uuid ?? null,
    );
    return ResponseWrapper.success(data, 'Prescription preset created');
  }

  @Get()
  @AnyMember()
  async findAll(
    @Query('category') category: string | undefined,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.findAll(ctx.organizationId, category);
    return ResponseWrapper.success(data);
  }

  @Get(':id')
  @AnyMember()
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.findOne(id, ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Patch(':id')
  @Can('prescriptions.library.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrescriptionPresetDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Prescription preset updated');
  }

  @Delete(':id')
  @Can('prescriptions.library.manage')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.deactivate(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Prescription preset deactivated');
  }
}
