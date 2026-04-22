import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { SetSalaryDto } from './dto/set-salary.dto';
import { EmployeeFilterDto } from './dto/employee-filter.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  // ═══════════════════════════════════════════════════════════
  // EMPLOYEE CRUD
  // ═══════════════════════════════════════════════════════════

  @Post()
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
  async findAll(
    @Query() filters: EmployeeFilterDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.employeesService.findAll(ctx, filters);
    return ResponseWrapper.success(data, 'Employees retrieved successfully');
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.employeesService.findOne(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Employee retrieved successfully');
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.employeesService.update(id, ctx, dto);
    return ResponseWrapper.success(data, 'Employee updated successfully');
  }

  @Patch(':id/deactivate')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.employeesService.deactivate(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Employee deactivated successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // SALARY MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  @Post(':id/salary')
  @HttpCode(HttpStatus.CREATED)
  async setSalary(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSalaryDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.employeesService.setSalary(
      id,
      ctx,
      dto,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Salary set successfully');
  }

  @Get(':id/salary-history')
  async getSalaryHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.employeesService.getSalaryHistory(
      id,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data, 'Salary history retrieved successfully');
  }
}
