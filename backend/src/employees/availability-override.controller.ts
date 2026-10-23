import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AvailabilityOverrideService } from './availability-override.service';
import {
  CreateAvailabilityOverrideDto,
  UpdateAvailabilityOverrideDto,
  OverrideFilterDto,
} from './dto/availability-override.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Can } from 'src/access/decorators/access.decorators';

@Controller('employees/:employeeId/availability-overrides')
export class AvailabilityOverrideController {
  constructor(private readonly overrideService: AvailabilityOverrideService) {}

  @Post()
  @Can('employees.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateAvailabilityOverrideDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.overrideService.create(
      employeeId,
      dto,
      ctx,
      req.user?.uuid,
    );
    return ResponseWrapper.success(
      data,
      'Availability override created successfully',
    );
  }

  @Get()
  @Can('employees.view')
  async findAll(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() filters: OverrideFilterDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.overrideService.findAll(employeeId, filters, ctx);
    return ResponseWrapper.success(
      data,
      'Availability overrides retrieved successfully',
    );
  }

  @Patch(':id')
  @Can('employees.manage')
  async update(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAvailabilityOverrideDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.overrideService.update(id, employeeId, dto, ctx);
    return ResponseWrapper.success(
      data,
      'Availability override updated successfully',
    );
  }

  @Delete(':id')
  @Can('employees.manage')
  async remove(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.overrideService.remove(id, employeeId, ctx);
    return ResponseWrapper.success(
      data,
      'Availability override deleted successfully',
    );
  }
}
