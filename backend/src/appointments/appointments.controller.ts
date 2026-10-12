import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
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
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { CurrentActor, Roles } from 'src/common/decorators/roles.decorator';
import { Actor, AppRole } from 'src/common/enums/app-role.enum';
import {
  IdempotencyInput,
  QueueOrchestrator,
} from 'src/queue/services/queue-orchestrator.service';
import { Idempotency } from 'src/queue/decorators/queue-request.decorators';
import { CheckInDto } from 'src/queue/dto/queue.dto';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';

const RECEPTION = [AppRole.RECEPTIONIST, AppRole.CLINIC_ADMIN];

@RequireFeature('appointments.core')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly queue: QueueOrchestrator,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════

  @Roles(...RECEPTION)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAppointmentDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentUserId() userId: string,
  ) {
    const data = await this.appointmentsService.create(ctx, dto, userId);
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
    const data = await this.appointmentsService.getStats(
      ctx,
      startDate,
      endDate,
    );
    return ResponseWrapper.success(data, 'Stats retrieved successfully');
  }

  @Get('availability')
  async getAvailability(
    @Query('doctorId') doctorId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.appointmentsService.getAvailability(
      ctx,
      doctorId,
      startDate,
      endDate,
    );
    return ResponseWrapper.success(data, 'Availability retrieved successfully');
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.appointmentsService.findOne(id, ctx);
    return ResponseWrapper.success(data, 'Appointment retrieved successfully');
  }

  @Roles(...RECEPTION)
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentUserId() userId: string,
  ) {
    const data = await this.appointmentsService.update(id, ctx, dto, userId);
    return ResponseWrapper.success(data, 'Appointment updated successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════

  @Roles(...RECEPTION)
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

  @Roles(...RECEPTION)
  @Patch(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentUserId() userId: string,
  ) {
    const data = await this.appointmentsService.cancel(id, ctx, dto, userId);
    return ResponseWrapper.success(data, 'Appointment cancelled');
  }

  @Roles(...RECEPTION)
  @Patch(':id/no-show')
  async noShow(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentUserId() userId: string,
  ) {
    const data = await this.appointmentsService.noShow(id, ctx, userId);
    return ResponseWrapper.success(data, 'Marked as no-show');
  }

  /**
   * Patient arrived: the queue issues a doctor-wise token (A-007). Response:
   * the queue entry, token, session. 422 LATE_LIMIT_EXCEEDED past max late.
   * Needs an Idempotency-Key so a retried check-in returns the same token.
   */
  @Roles(...RECEPTION)
  @Patch(':id/check-in')
  async checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckInDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.queue.checkInAppointment(ctx, actor, id, dto, idem);
    return ResponseWrapper.success(data, `Checked in — token ${data.token}`);
  }

  /** Past the late limit: appointment → no-show, patient joins as a walk-in. */
  @Roles(...RECEPTION)
  @Post(':id/convert-to-walk-in')
  async convertToWalkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckInDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentActor() actor: Actor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.queue.convertToWalkIn(ctx, actor, id, dto, idem);
    return ResponseWrapper.success(
      data,
      `Added as walk-in — token ${data.token}`,
    );
  }

  @Roles(...RECEPTION)
  @Patch(':id/confirm')
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @CurrentUserId() userId: string,
  ) {
    const data = await this.appointmentsService.confirm(id, ctx, userId);
    return ResponseWrapper.success(data, 'Appointment confirmed');
  }
}
