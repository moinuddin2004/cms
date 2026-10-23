import {
  Controller,
  Get,
  Post,
  Put,
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
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateSalaryDto } from './dto/update-salary.dto';
import { EmployeeFilterDto } from './dto/employee-filter.dto';
import { UpdateEmployeeStatusDto } from './dto/update-employee-status.dto';
import { TogglePortalAccessDto } from './dto/toggle-portal-access.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Can } from 'src/access/decorators/access.decorators';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  // ═══════════════════════════════════════════════════════════
  // EMPLOYEE CRUD
  // ═══════════════════════════════════════════════════════════

  @Post()
  @Can('employees.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateEmployeeDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.employeesService.create(ctx, dto, req.user?.uuid);
    return ResponseWrapper.success(data, 'Employee created successfully');
  }

  @Get()
  @Can('employees.view')
  async findAll(
    @Query() filters: EmployeeFilterDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.employeesService.findAll(ctx, filters);
    return ResponseWrapper.success(data, 'Employees retrieved successfully');
  }

  @Get(':id')
  @Can('employees.view')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.employeesService.findOne(id, ctx);
    return ResponseWrapper.success(data, 'Employee retrieved successfully');
  }

  @Put(':id')
  @Can('employees.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.employeesService.update(id, ctx, dto);
    return ResponseWrapper.success(data, 'Employee updated successfully');
  }

  @Patch(':id/status')
  @Can('employees.manage')
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeStatusDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.employeesService.setActive(id, ctx, dto.isActive);
    return ResponseWrapper.success(
      data,
      dto.isActive
        ? 'Employee activated successfully'
        : 'Employee deactivated successfully',
    );
  }

  @Delete(':id')
  @Can('employees.manage')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    await this.employeesService.remove(id, ctx);
    return ResponseWrapper.success(null, 'Employee deleted permanently');
  }

  // ═══════════════════════════════════════════════════════════
  // PORTAL ACCESS
  // ═══════════════════════════════════════════════════════════

  @Patch(':id/portal-access')
  @Can('employees.manage')
  async togglePortalAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TogglePortalAccessDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.employeesService.togglePortalAccess(
      id,
      ctx,
      dto.hasPortalAccess,
    );
    return ResponseWrapper.success(
      data,
      data.hasPortalAccess ? 'Portal access enabled' : 'Portal access disabled',
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SALARY MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  @Patch(':id/salary')
  @Can('employees.manage')
  async updateSalary(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalaryDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.employeesService.updateSalary(id, ctx, dto);
    return ResponseWrapper.success(data, 'Salary updated successfully');
  }
}
