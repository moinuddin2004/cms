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
  Res,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { PayrollService } from './payroll.service';
import { PayrollExportService } from './payroll-export.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AppRole } from 'src/common/enums/app-role.enum';

@RequireFeature('hr.payroll')
@Controller('payroll')
@Roles(AppRole.CLINIC_ADMIN)
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly payrollExportService: PayrollExportService,
  ) {}

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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePayrollDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.payrollService.createManual(
      dto,
      ctx,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Payroll record created successfully');
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

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePayrollDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.payrollService.update(id, dto, ctx.organizationId);
    return ResponseWrapper.success(data, 'Payroll record updated successfully');
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.payrollService.remove(id, ctx.organizationId);
    return ResponseWrapper.success(data, 'Payroll record deleted successfully');
  }

  @Get('export')
  async exportCsv(
    @Query('month') month: string,
    @Query('year') year: string,
    @ActiveTenant() ctx: TenantContext,
    @Res() res: Response,
  ) {
    const csv = await this.payrollExportService.generatePayrollSummaryCsv(
      ctx,
      parseInt(month, 10),
      parseInt(year, 10),
    );
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="payroll-${year}-${month}.csv"`,
    });
    res.end(csv);
  }

  @Get(':id/payslip-pdf')
  async payslipPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Res() res: Response,
  ) {
    const { buffer, fileName } =
      await this.payrollExportService.generatePayslipPdf(
        id,
        ctx.organizationId,
      );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }
}
