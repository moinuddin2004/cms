import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  async generate(
    @Body() dto: GeneratePayrollDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.payrollService.generate(dto, ctx, req.user?.uuid);
    return ResponseWrapper.success(data, 'Payroll generated successfully');
  }

  @Get('location')
  async findByLocation(
    @Query('month') month: string,
    @Query('year') year: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.payrollService.findByLocation(
      ctx,
      parseInt(month, 10),
      parseInt(year, 10),
    );
    return ResponseWrapper.success(
      data,
      'Location payroll records retrieved successfully',
    );
  }

  @Get('employee/:id')
  async findByEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.payrollService.findByEmployee(
      id,
      ctx.organizationId,
    );
    return ResponseWrapper.success(
      data,
      'Employee payroll records retrieved successfully',
    );
  }

  @Patch(':id/mark-paid')
  async markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPaidDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.payrollService.markPaid(
      id,
      dto,
      ctx.organizationId,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Payroll marked as paid successfully');
  }

  @Patch(':id/mark-on-hold')
  async markOnHold(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.payrollService.markOnHold(
      id,
      ctx.organizationId,
    );
    return ResponseWrapper.success(
      data,
      'Payroll marked as on hold successfully',
    );
  }
}
