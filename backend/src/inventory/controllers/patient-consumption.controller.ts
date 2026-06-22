import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PatientConsumptionService } from '../services/patient-consumption.service';
import {
  RecordConsumptionDto,
  ConsumptionReportQueryDto,
} from '../dto/patient-consumption.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('patient-consumptions')
@RequireFeature('inventory.core')
export class PatientConsumptionController {
  constructor(
    private readonly consumptionService: PatientConsumptionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async recordConsumption(
    @Body() dto: RecordConsumptionDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.consumptionService.recordConsumption(
      ctx.organizationId,
      ctx.locationId,
      dto,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Consumption recorded successfully');
  }

  @Get('report')
  async getConsumptionReport(
    @Query() query: ConsumptionReportQueryDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.consumptionService.getConsumptionReport(
      ctx.organizationId,
      ctx.locationId,
      query.dateFrom,
      query.dateTo,
    );
    return ResponseWrapper.success(data);
  }

  @Get('appointment/:appointmentId')
  async getByAppointment(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.consumptionService.getByAppointment(
      appointmentId,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data);
  }

  @Get('patient/:patientId')
  async getByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.consumptionService.getByPatient(
      patientId,
      ctx.organizationId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return ResponseWrapper.success(data);
  }
}
