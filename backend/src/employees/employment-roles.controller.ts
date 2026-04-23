import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EmploymentRolesService } from './employment-roles.service';
import { CreateEmploymentRoleDto } from './dto/create-employment-role.dto';
import { UpdateEmploymentRoleDto } from './dto/update-employment-role.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('employment-roles')
export class EmploymentRolesController {
  constructor(private readonly rolesService: EmploymentRolesService) {}

  @Get()
  async findAll(@ActiveTenant() ctx: TenantContext) {
    const data = await this.rolesService.findAll(ctx.organizationId);
    return ResponseWrapper.success(data, 'Employment roles retrieved successfully');
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.rolesService.findOne(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Employment role retrieved successfully');
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateEmploymentRoleDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.rolesService.create(ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Employment role created successfully');
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmploymentRoleDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.rolesService.update(id, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Employment role updated successfully');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    await this.rolesService.remove(id, ctx.organizationId);
    return ResponseWrapper.success(null, 'Employment role deleted successfully');
  }
}
