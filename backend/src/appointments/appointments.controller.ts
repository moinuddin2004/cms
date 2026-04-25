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
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ValidateAppointmentDto } from './dto/validate-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { AppointmentFilterDto } from './dto/appointment-filter.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // ═══════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAppointmentDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.appointmentsService.create(ctx, dto, req.user?.uuid);
    return ResponseWrapper.success(data, 'Appointment created successfully');
  }

  @Get()
  async findAll(
    @Query() filters: AppointmentFilterDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.appointmentsService.findAll(ctx, filters);
    return ResponseWrapper.success(data, 'Appointments retrieved successfully');
  }

  @Get('doctors')
  async getDoctors(@ActiveTenant() ctx: TenantContext) {
    const data = await this.appointmentsService.getDoctors(ctx);
    return ResponseWrapper.success(data, 'Doctors retrieved successfully');
  }

  @Get('stats')
  async getStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.appointmentsService.getStats(ctx, startDate, endDate);
    return ResponseWrapper.success(data, 'Stats retrieved successfully');
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.appointmentsService.findOne(id, ctx);
    return ResponseWrapper.success(data, 'Appointment retrieved successfully');
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.appointmentsService.update(id, ctx, dto, req.user?.uuid);
    return ResponseWrapper.success(data, 'Appointment updated successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validate(
    @Body() dto: ValidateAppointmentDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.appointmentsService.validate(ctx, dto);
    return ResponseWrapper.success(data, 'Validation complete');
  }

  // ═══════════════════════════════════════════════════════════
  // STATUS TRANSITIONS
  // ═══════════════════════════════════════════════════════════

  @Patch(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.appointmentsService.cancel(id, ctx, dto, req.user?.uuid);
    return ResponseWrapper.success(data, 'Appointment cancelled');
  }

  @Patch(':id/no-show')
  async noShow(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.appointmentsService.noShow(id, ctx, req.user?.uuid);
    return ResponseWrapper.success(data, 'Marked as no-show');
  }

  @Patch(':id/check-in')
  async checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.appointmentsService.checkIn(id, ctx, req.user?.uuid);
    return ResponseWrapper.success(data, 'Patient checked in');
  }

  @Patch(':id/complete')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.appointmentsService.complete(id, ctx, req.user?.uuid);
    return ResponseWrapper.success(data, 'Appointment completed');
  }

  @Patch(':id/confirm')
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.appointmentsService.confirm(id, ctx, req.user?.uuid);
    return ResponseWrapper.success(data, 'Appointment confirmed');
  }
}
