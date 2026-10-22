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
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import type { AccessContext } from 'src/access/access-context';
import { Access, Can } from 'src/access/decorators/access.decorators';
import {
  IdempotencyInput,
  QueueOrchestrator,
} from 'src/queue/services/queue-orchestrator.service';
import {
  CurrentQueueActor,
  Idempotency,
} from 'src/queue/decorators/queue-request.decorators';
import type { QueueActor } from 'src/queue/queue-actor';
import { CheckInDto } from 'src/queue/dto/queue.dto';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';

/**
 * Bookings. Reads are limited to the `appointments.view` scope (`own` → the
 * doctor's own bookings); arrivals hand over to the queue (`queue.checkin`).
 */
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly queue: QueueOrchestrator,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════

  @Can('appointments.book')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateAppointmentDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentUserId() userId: string,
    @Access() access: AccessContext,
  ) {
    const data = await this.appointmentsService.create(
      ctx,
      dto,
      userId,
      access,
    );
    return ResponseWrapper.success(data, 'Appointment created successfully');
  }

  @Can('appointments.view')
  @Get()
  async findAll(
    @Query() filters: AppointmentFilterDto,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    const data = await this.appointmentsService.findAll(ctx, filters, access);
    return ResponseWrapper.success(data, 'Appointments retrieved successfully');
  }

  @Can('appointments.view')
  @Get('doctors')
  async getDoctors(@ActiveTenant() ctx: TenantContext) {
    const data = await this.appointmentsService.getDoctors(ctx);
    return ResponseWrapper.success(data, 'Doctors retrieved successfully');
  }

  @Can('appointments.view')
  @Get('stats')
  async getStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    const data = await this.appointmentsService.getStats(
      ctx,
      access,
      startDate,
      endDate,
    );
    return ResponseWrapper.success(data, 'Stats retrieved successfully');
  }

  @Can('appointments.view')
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

  @Can('appointments.view')
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
    @Access() access: AccessContext,
  ) {
    const data = await this.appointmentsService.findOne(id, ctx, access);
    return ResponseWrapper.success(data, 'Appointment retrieved successfully');
  }

  @Can('appointments.reschedule')
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentUserId() userId: string,
    @Access() access: AccessContext,
  ) {
    const data = await this.appointmentsService.update(
      id,
      ctx,
      dto,
      userId,
      access,
    );
    return ResponseWrapper.success(data, 'Appointment updated successfully');
  }

  // ═══════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════

  @Can('appointments.book')
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

  @Can('appointments.cancel')
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

  /** Ends the booking like a cancel does, so it shares that permission. */
  @Can('appointments.cancel')
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
  @Can('queue.checkin')
  @Patch(':id/check-in')
  async checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckInDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.queue.checkInAppointment(ctx, actor, id, dto, idem);
    return ResponseWrapper.success(data, `Checked in — token ${data.token}`);
  }

  /** Past the late limit: appointment → no-show, patient joins as a walk-in. */
  @Can('queue.checkin')
  @Post(':id/convert-to-walk-in')
  async convertToWalkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckInDto,
    @ActiveTenant() ctx: TenantContext,
    @CurrentQueueActor() actor: QueueActor,
    @Idempotency() idem: IdempotencyInput,
  ) {
    const data = await this.queue.convertToWalkIn(ctx, actor, id, dto, idem);
    return ResponseWrapper.success(
      data,
      `Added as walk-in — token ${data.token}`,
    );
  }

  @Can('appointments.book')
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
