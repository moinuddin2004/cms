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
import { MedicineDirectoryService } from '../services/medicine-directory.service';
import {
  CreateMedicineDirectoryDto,
  SearchMedicineDto,
  UpdateMedicineDirectoryDto,
} from '../dto/medicine-directory.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { AnyMember, Can } from 'src/access/decorators/access.decorators';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

// Reads are @AnyMember, so the feature check stays at class level.
@RequireFeature('patients.prescriptions')
@Controller('medicine-directory')
export class MedicineDirectoryController {
  constructor(private readonly service: MedicineDirectoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Can('prescriptions.library.manage')
  async create(
    @Body() dto: CreateMedicineDirectoryDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.create(ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Medicine added to directory');
  }

  @Get()
  @AnyMember()
  async findAll(@ActiveTenant() ctx: TenantContext) {
    const data = await this.service.findAll(ctx.organizationId);
    return ResponseWrapper.success(data);
  }

  @Get('search')
  @AnyMember()
  async search(
    @Query() query: SearchMedicineDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.search(ctx.organizationId, query);
    return ResponseWrapper.success(data);
  }

  @Post('seed-common')
  @HttpCode(HttpStatus.OK)
  @Can('prescriptions.library.manage')
  async seedCommon(@ActiveTenant() ctx: TenantContext) {
    const data = await this.service.seedCommonMedicines(ctx.organizationId);
    return ResponseWrapper.success(
      data,
      data.skipped ? 'Directory already populated' : 'Common medicines seeded',
    );
  }

  @Patch(':id')
  @Can('prescriptions.library.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicineDirectoryDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Medicine updated');
  }

  @Delete(':id')
  @Can('prescriptions.library.manage')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.service.deactivate(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Medicine deactivated');
  }
}
