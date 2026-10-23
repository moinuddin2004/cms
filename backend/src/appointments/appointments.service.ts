import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { EmployeeSchedule } from 'src/employees/entities/employee-schedule.entity';
import { LocationSettings } from 'src/locations/entities/location-settings.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import {
  ValidateAppointmentDto,
  ValidationResult,
} from './dto/validate-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { AppointmentFilterDto } from './dto/appointment-filter.dto';
import { AppointmentStatus } from 'src/common/enums/appointment-status.enum';
import { AppointmentType } from 'src/common/enums/appointment-type.enum';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import type { AccessContext } from 'src/access/access-context';
import { noPermission } from 'src/access/decorators/access.decorators';
import { rowInScope, scopeSql } from './appointment-scope';
import { ClockService } from 'src/common/clock/clock.service';
import { addDays, dayOfWeekOf } from 'src/common/clock/tz.util';
import { assertEditable, assertTransition } from './appointment-transitions';
import { pgError, sqlRows } from 'src/common/database/sql';

/**
 * Which queue-entry statuses a booking-style status filter means for
 * walk-ins. Booking-only statuses (scheduled, confirmed, no-show) are absent:
 * a walk-in is never in them, so filtering by one leaves walk-ins out.
 */
const WALK_IN_STATUS_FILTER: Partial<Record<AppointmentStatus, string[]>> = {
  [AppointmentStatus.CHECKED_IN]: [
    'waiting',
    'called',
    'in_consultation',
    'on_hold',
    'skipped',
  ],
  [AppointmentStatus.COMPLETED]: ['completed'],
  [AppointmentStatus.CANCELLED]: ['cancelled', 'aborted', 'transferred'],
};

/** The booking-style status a walk-in's queue status is shown as. */
function walkInStatus(queueStatus: string): AppointmentStatus {
  if (queueStatus === 'completed') return AppointmentStatus.COMPLETED;
  if (
    WALK_IN_STATUS_FILTER[AppointmentStatus.CANCELLED]?.includes(queueStatus)
  ) {
    return AppointmentStatus.CANCELLED;
  }
  return AppointmentStatus.CHECKED_IN;
}

/** An appointment's queue entry, as shown next to the booking. */
export interface QueueEntrySummary {
  id: string;
  /** Doctor-wise token, e.g. "A-007". */
  token: string;
  status: string;
  sessionId: string;
}

/** A doctor's working-hours block, as drawn behind the calendar. */
export interface AvailabilityBlock {
  doctorId: string;
  doctorName: string;
  start: string;
  end: string;
  dayOfWeek: number;
  slotDuration: number;
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** Statuses that occupy a doctor's time and count toward daily limits. */
const BLOCKING_EXCLUDED = [
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

/** `appointments.view` scope columns for bookings and for walk-in sessions. */
const APPOINTMENT_SCOPE = { own: 'a.doctor_id', location: 'a.location_id' };
const SESSION_SCOPE = { own: 's.doctor_id', location: 's.location_id' };

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(EmployeeOrgLocationAssignment)
    private readonly assignmentRepo: Repository<EmployeeOrgLocationAssignment>,
    @InjectRepository(EmployeeSchedule)
    private readonly scheduleRepo: Repository<EmployeeSchedule>,
    @InjectRepository(LocationSettings)
    private readonly settingsRepo: Repository<LocationSettings>,
    private readonly dataSource: DataSource,
    private readonly clock: ClockService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // 1. CREATE APPOINTMENT
  // ═══════════════════════════════════════════════════════════

  async create(
    ctx: TenantContext,
    dto: CreateAppointmentDto,
    userId: string,
    access?: AccessContext,
  ): Promise<Appointment> {
    const override = this.overridesRules(dto.overrideRules, access);
    const tz = await this.clock.timezoneFor(ctx.locationId);
    const startTime = new Date(dto.startTime);
    const endTime = new Date(startTime.getTime() + dto.duration * 60000);

    // 1. Validate start_time is not in the past
    if (startTime < this.clock.now()) {
      throw new BadRequestException('Cannot book appointments in the past');
    }

    // 2. Validate start < end
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // 3. Validate patient exists
    const patient = await this.patientRepo.findOne({
      where: { id: dto.patientId, organizationId: ctx.organizationId },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // 4–5. Validate doctor exists, is active, and belongs to this location
    await this.assertDoctorAtLocation(ctx, dto.doctorId);

    // 6. Check GLOBAL schedule validity (location-local weekday + time)
    if (!override) {
      await this.validateSchedule(dto.doctorId, startTime, endTime, tz);
    }

    // 7. Check GLOBAL appointment conflict
    await this.checkGlobalConflict(dto.doctorId, startTime, endTime);

    // 8. Location's daily booking limit (location_settings.max_appointments_per_day)
    if (!override) await this.assertDailyLimit(ctx, startTime, tz);

    // 9. Save appointment. A booking never gets a token — the doctor-wise
    //    token is issued by the queue when the patient actually arrives.
    const appointment = this.appointmentRepo.create({
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
      patientId: dto.patientId,
      doctorId: dto.doctorId,
      type: dto.type || AppointmentType.CONSULTATION,
      status: AppointmentStatus.SCHEDULED,
      startTime,
      endTime,
      durationMinutes: dto.duration,
      reasonForVisit: dto.reasonForVisit || null,
      isEmergency: dto.isEmergency || false,
      notes: dto.notes || null,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.saveBooking(appointment);

    return this.findOne(saved.id, ctx);
  }

  // ═══════════════════════════════════════════════════════════
  // 2. VALIDATE ENDPOINT (Real-time)
  // ═══════════════════════════════════════════════════════════

  async validate(
    ctx: TenantContext,
    dto: ValidateAppointmentDto,
  ): Promise<ValidationResult> {
    const tz = await this.clock.timezoneFor(ctx.locationId);
    const startTime = new Date(dto.startTime);
    const endTime = new Date(startTime.getTime() + dto.duration * 60000);

    // Check doctor exists, is active and belongs to the location
    try {
      await this.assertDoctorAtLocation(ctx, dto.doctorId);
    } catch (e) {
      return { valid: false, reason: errorMessage(e, 'Doctor not available') };
    }

    // Check schedule
    try {
      await this.validateSchedule(dto.doctorId, startTime, endTime, tz);
    } catch (e) {
      return {
        valid: false,
        reason: errorMessage(e, 'Outside doctor schedule'),
      };
    }

    // Check global conflict
    const conflict = await this.findConflict(
      dto.doctorId,
      startTime,
      endTime,
      dto.excludeAppointmentId,
    );
    if (conflict) {
      // Suggest next free slot
      const suggested = await this.suggestNextSlot(
        dto.doctorId,
        startTime,
        dto.duration,
        tz,
        dto.excludeAppointmentId,
      );
      return {
        valid: false,
        reason: `Doctor busy${conflict.locationId !== ctx.locationId ? ' at another location' : ''}`,
        conflictLocation:
          conflict.locationId !== ctx.locationId
            ? 'Another location'
            : 'Same location',
        suggestedStartTime: suggested?.toISOString(),
      };
    }

    // Location's daily booking limit
    const limitReason = await this.dailyLimitReason(
      ctx,
      startTime,
      tz,
      dto.excludeAppointmentId,
    );
    if (limitReason) return { valid: false, reason: limitReason };

    return { valid: true };
  }

  // ═══════════════════════════════════════════════════════════
  // 3. UPDATE / RESCHEDULE
  // ═══════════════════════════════════════════════════════════

  /**
   * Edit a booking before check-in. Changing the time reschedules it on the
   * SAME row and keeps its status (scheduled / confirmed); schedule, conflict
   * and daily-limit checks re-run only when time or doctor actually change.
   */
  async update(
    id: string,
    ctx: TenantContext,
    dto: UpdateAppointmentDto,
    userId: string,
    access?: AccessContext,
  ): Promise<Appointment> {
    const override = this.overridesRules(dto.overrideRules, access);
    const existing = await this.appointmentRepo.findOne({
      where: { id, locationId: ctx.locationId },
    });
    if (!existing) {
      throw new NotFoundException('Appointment not found');
    }

    // Only bookings that haven't been checked in can change (422 otherwise).
    assertEditable(existing.status);

    const doctorId = dto.doctorId || existing.doctorId;
    const duration = dto.duration || existing.durationMinutes;
    const startTime = dto.startTime
      ? new Date(dto.startTime)
      : existing.startTime;
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const timeChanged =
      startTime.getTime() !== existing.startTime.getTime() ||
      duration !== existing.durationMinutes;
    const doctorChanged = !!dto.doctorId && dto.doctorId !== existing.doctorId;

    // Re-validate patient if changed
    if (dto.patientId && dto.patientId !== existing.patientId) {
      const patient = await this.patientRepo.findOne({
        where: { id: dto.patientId, organizationId: ctx.organizationId },
      });
      if (!patient) {
        throw new NotFoundException('Patient not found');
      }
    }

    // Re-validate doctor if changed
    if (doctorChanged) {
      await this.assertDoctorAtLocation(ctx, dto.doctorId!);
    }

    // Re-run schedule + conflict + limit checks only for a real change
    if (timeChanged || doctorChanged) {
      const tz = await this.clock.timezoneFor(ctx.locationId);
      if (
        startTime.getTime() !== existing.startTime.getTime() &&
        startTime < this.clock.now()
      ) {
        throw new BadRequestException(
          'Cannot move an appointment into the past',
        );
      }
      if (!override) {
        await this.validateSchedule(doctorId, startTime, endTime, tz);
      }
      await this.checkGlobalConflict(doctorId, startTime, endTime, id);
      if (!override) await this.assertDailyLimit(ctx, startTime, tz, id);
    }

    // Update fields — status is deliberately left as it is.
    if (dto.patientId) existing.patientId = dto.patientId;
    if (dto.doctorId) existing.doctorId = dto.doctorId;
    if (dto.type) existing.type = dto.type;
    if (dto.notes !== undefined) existing.notes = dto.notes || null;
    if (timeChanged) {
      existing.startTime = startTime;
      existing.endTime = endTime;
      existing.durationMinutes = duration;
    }
    existing.updatedBy = userId;

    await this.saveBooking(existing);
    return this.findOne(id, ctx);
  }

  // ═══════════════════════════════════════════════════════════
  // 4. STATUS TRANSITIONS (before arrival) — checked against the map.
  //    Check-in, and everything after it, is the QueueOrchestrator's job.
  // ═══════════════════════════════════════════════════════════

  /** Cancel a booking before check-in. After arrival use the queue's cancel. */
  async cancel(
    id: string,
    ctx: TenantContext,
    dto: CancelAppointmentDto,
    userId: string,
  ): Promise<Appointment> {
    const appt = await this.getForUpdate(id, ctx);
    if (appt.status === AppointmentStatus.CHECKED_IN) {
      throw new UnprocessableEntityException({
        message:
          'The patient has checked in — remove them from the queue instead',
        code: 'INVALID_TRANSITION',
      });
    }
    assertTransition(appt.status, AppointmentStatus.CANCELLED);

    appt.status = AppointmentStatus.CANCELLED;
    appt.cancelReasonCode = dto.reasonCode || null;
    appt.cancelReason = dto.reason || null;
    appt.cancelledAt = this.clock.now();
    appt.updatedBy = userId;

    await this.appointmentRepo.save(appt);
    return this.findOne(id, ctx);
  }

  /** Patient never arrived. Only from scheduled / confirmed. */
  async noShow(
    id: string,
    ctx: TenantContext,
    userId: string,
  ): Promise<Appointment> {
    const appt = await this.getForUpdate(id, ctx);
    assertTransition(appt.status, AppointmentStatus.NO_SHOW);

    appt.status = AppointmentStatus.NO_SHOW;
    appt.noShowAt = this.clock.now();
    appt.updatedBy = userId;

    await this.appointmentRepo.save(appt);
    return this.findOne(id, ctx);
  }

  async confirm(
    id: string,
    ctx: TenantContext,
    userId: string,
  ): Promise<Appointment> {
    const appt = await this.getForUpdate(id, ctx);
    assertTransition(appt.status, AppointmentStatus.CONFIRMED);

    appt.status = AppointmentStatus.CONFIRMED;
    appt.updatedBy = userId;

    await this.appointmentRepo.save(appt);
    return this.findOne(id, ctx);
  }

  private async getForUpdate(
    id: string,
    ctx: TenantContext,
  ): Promise<Appointment> {
    const appt = await this.appointmentRepo.findOne({
      where: { id, locationId: ctx.locationId },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    return appt;
  }

  // ═══════════════════════════════════════════════════════════
  // 5. QUERIES
  // ═══════════════════════════════════════════════════════════

  /**
   * The appointments list, limited to what `appointments.view` reaches:
   * `own` → the doctor's own bookings, `location` / `org` → the location.
   */
  async findAll(
    ctx: TenantContext,
    filters: AppointmentFilterDto,
    access: AccessContext,
  ) {
    if (filters.includeWalkIns) {
      return this.findAllWithWalkIns(ctx, filters, access);
    }
    if (filters.type === 'walk_in') {
      // Walk-ins are not bookings — nothing to return unless they were asked for.
      return {
        data: [],
        total: 0,
        page: filters.page || 1,
        limit: filters.limit || 50,
      };
    }
    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patient', 'patient')
      .leftJoinAndSelect('a.doctor', 'doctor')
      .leftJoinAndSelect('a.location', 'location')
      .where('a.location_id = :locationId', { locationId: ctx.locationId });
    access.applyScope(qb, 'appointments.view', APPOINTMENT_SCOPE);

    if (filters.startDate) {
      qb.andWhere('a.start_time >= :startDate', {
        startDate: new Date(filters.startDate),
      });
    }
    if (filters.endDate) {
      qb.andWhere('a.start_time <= :endDate', {
        endDate: new Date(filters.endDate),
      });
    }
    if (filters.doctorId) {
      qb.andWhere('a.doctor_id = :doctorId', { doctorId: filters.doctorId });
    }
    if (filters.patientId) {
      qb.andWhere('a.patient_id = :patientId', {
        patientId: filters.patientId,
      });
    }
    if (filters.status) {
      qb.andWhere('a.status = :status', { status: filters.status });
    }
    if (filters.type) {
      qb.andWhere('a.type = :type', { type: filters.type });
    }
    if (filters.search) {
      // ILIKE across the joined patient row (name / phone / patient number).
      qb.andWhere(
        `(
          patient.full_name ILIKE :search
          OR patient.phone ILIKE :search
          OR patient.patient_number ILIKE :search
        )`,
        { search: `%${filters.search}%` },
      );
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;

    qb.orderBy('a.startTime', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data: await this.withQueueEntries(data), total, page, limit };
  }

  /**
   * The appointments list with walk-ins merged in. Walk-ins never had a
   * booking, so they exist only as queue entries; both kinds are put in one
   * UNION, sorted by time and paged together so every page (and the total) is
   * right. Walk-in rows are shaped like appointments (`kind: 'walk_in'`) so
   * the same table can show them.
   *
   * Filters: a booking-only type or status (scheduled / confirmed / no-show)
   * leaves walk-ins out; `type=walk_in` leaves bookings out; a queue entry
   * that is still in the queue counts as `checked_in`.
   */
  private async findAllWithWalkIns(
    ctx: TenantContext,
    filters: AppointmentFilterDto,
    access: AccessContext,
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const params: unknown[] = [];
    const arg = (v: unknown) => {
      params.push(v);
      return `$${params.length}`;
    };

    const loc = arg(ctx.locationId);
    const from = filters.startDate ? arg(new Date(filters.startDate)) : null;
    const to = filters.endDate ? arg(new Date(filters.endDate)) : null;
    const doctor = filters.doctorId ? arg(filters.doctorId) : null;
    const patient = filters.patientId ? arg(filters.patientId) : null;
    const like = filters.search ? arg(`%${filters.search}%`) : null;
    const searchSql = like
      ? `AND (p.full_name ILIKE ${like} OR p.phone ILIKE ${like} OR p.patient_number ILIKE ${like})`
      : '';

    const parts: string[] = [];

    if (filters.type !== 'walk_in') {
      parts.push(`
        SELECT 'appointment'::text AS kind, a.id, a.start_time AS sort_at
          FROM appointments a
          JOIN patients p ON p.id = a.patient_id
         WHERE a.location_id = ${loc}
           ${scopeSql(access, 'appointments.view', APPOINTMENT_SCOPE, arg)}
           ${from ? `AND a.start_time >= ${from}` : ''}
           ${to ? `AND a.start_time <= ${to}` : ''}
           ${doctor ? `AND a.doctor_id = ${doctor}` : ''}
           ${patient ? `AND a.patient_id = ${patient}` : ''}
           ${filters.status ? `AND a.status::text = ${arg(filters.status)}` : ''}
           ${filters.type ? `AND a.type::text = ${arg(filters.type)}` : ''}
           ${searchSql}`);
    }

    const queueStatuses = filters.status
      ? WALK_IN_STATUS_FILTER[filters.status]
      : undefined;
    const walkInsWanted =
      (!filters.type || filters.type === 'walk_in') &&
      (!filters.status || !!queueStatuses);
    if (walkInsWanted) {
      parts.push(`
        SELECT 'walk_in'::text AS kind, e.id, e.checked_in_at AS sort_at
          FROM queue_entries e
          JOIN queue_sessions s ON s.id = e.queue_session_id
          JOIN patients p ON p.id = e.patient_id
         WHERE s.location_id = ${loc}
           AND e.queue_type = 'walk_in'
           ${scopeSql(access, 'appointments.view', SESSION_SCOPE, arg)}
           ${from ? `AND e.checked_in_at >= ${from}` : ''}
           ${to ? `AND e.checked_in_at <= ${to}` : ''}
           ${doctor ? `AND s.doctor_id = ${doctor}` : ''}
           ${patient ? `AND e.patient_id = ${patient}` : ''}
           ${queueStatuses ? `AND e.status::text = ANY(${arg(queueStatuses)}::text[])` : ''}
           ${searchSql}`);
    }

    if (parts.length === 0) return { data: [], total: 0, page, limit };
    const union = parts.join(' UNION ALL ');

    const [{ n }] = await sqlRows<{ n: number }>(
      this.dataSource,
      `SELECT COUNT(*)::int AS n FROM (${union}) u`,
      [...params],
    );
    const pageRows = await sqlRows<{
      kind: 'appointment' | 'walk_in';
      id: string;
    }>(
      this.dataSource,
      `SELECT kind, id FROM (${union}) u
        ORDER BY sort_at ASC, id ASC
        LIMIT ${arg(limit)} OFFSET ${arg((page - 1) * limit)}`,
      params,
    );

    const apptIds = pageRows
      .filter((r) => r.kind === 'appointment')
      .map((r) => r.id);
    const walkInIds = pageRows
      .filter((r) => r.kind === 'walk_in')
      .map((r) => r.id);

    const appointments = apptIds.length
      ? await this.withQueueEntries(
          await this.appointmentRepo.find({
            where: { id: In(apptIds) },
            relations: ['patient', 'doctor', 'location'],
          }),
        )
      : [];
    const apptById = new Map(appointments.map((a) => [a.id, a]));
    const walkInById = await this.loadWalkInRows(walkInIds);

    const data = pageRows
      .map((r) => {
        if (r.kind === 'walk_in') return walkInById.get(r.id);
        const a = apptById.get(r.id);
        return a
          ? Object.assign(a, { kind: 'appointment' as const })
          : undefined;
      })
      .filter((row) => row !== undefined);

    return { data, total: n, page, limit };
  }

  /** Walk-in queue entries dressed as appointment rows for the shared list. */
  private async loadWalkInRows(ids: string[]) {
    const out = new Map<string, Record<string, unknown>>();
    if (ids.length === 0) return out;
    const rows = await sqlRows<{
      id: string;
      organization_id: string;
      status: string;
      priority_class: string;
      token_number: number;
      queue_session_id: string;
      checked_in_at: Date;
      finished_at: Date | null;
      reason_for_visit: string | null;
      patient_id: string;
      doctor_id: string;
      location_id: string;
      token_prefix: string;
      full_name: string;
      phone: string;
      patient_number: string | null;
      doctor_name: string | null;
    }>(
      this.dataSource,
      `SELECT e.id, e.organization_id, e.status::text AS status,
              e.priority_class::text AS priority_class, e.token_number,
              e.queue_session_id, e.checked_in_at, e.finished_at,
              e.reason_for_visit, e.patient_id,
              s.doctor_id, s.location_id, s.token_prefix,
              p.full_name, p.phone, p.patient_number,
              d.full_name AS doctor_name
         FROM queue_entries e
         JOIN queue_sessions s ON s.id = e.queue_session_id
         JOIN patients p ON p.id = e.patient_id
         LEFT JOIN employees d ON d.id = s.doctor_id
        WHERE e.id = ANY($1::uuid[])`,
      [ids],
    );
    for (const r of rows) {
      const arrived = new Date(r.checked_in_at).toISOString();
      out.set(r.id, {
        kind: 'walk_in',
        // The queue entry's id — walk-ins have no appointment row.
        id: r.id,
        organizationId: r.organization_id,
        locationId: r.location_id,
        patientId: r.patient_id,
        doctorId: r.doctor_id,
        type: 'walk_in',
        status: walkInStatus(r.status),
        startTime: arrived,
        endTime: r.finished_at
          ? new Date(r.finished_at).toISOString()
          : arrived,
        durationMinutes: 0,
        reasonForVisit: r.reason_for_visit,
        isEmergency: r.priority_class === 'authorized_urgent',
        notes: null,
        checkedInAt: arrived,
        patient: {
          id: r.patient_id,
          fullName: r.full_name,
          phone: r.phone,
          patientNumber: r.patient_number,
        },
        doctor: { id: r.doctor_id, fullName: r.doctor_name ?? '' },
        queueEntry: {
          id: r.id,
          status: r.status,
          token: `${r.token_prefix}-${String(r.token_number).padStart(3, '0')}`,
          sessionId: r.queue_session_id,
        },
      });
    }
    return out;
  }

  /** One booking; with `access`, outside the `appointments.view` scope reads as not found. */
  async findOne(
    id: string,
    ctx: TenantContext,
    access?: AccessContext,
  ): Promise<Appointment & { queueEntry: QueueEntrySummary | null }> {
    const appt = await this.appointmentRepo.findOne({
      where: { id, locationId: ctx.locationId },
      relations: ['patient', 'doctor', 'location'],
    });
    if (
      !appt ||
      (access &&
        !rowInScope(access, 'appointments.view', {
          own: appt.doctorId,
          location: appt.locationId,
        }))
    ) {
      throw new NotFoundException('Appointment not found');
    }
    const [withEntry] = await this.withQueueEntries([appt]);
    return withEntry;
  }

  /**
   * Attach each appointment's latest queue entry (doctor-wise token + queue
   * status) so lists and the detail view can show "A-007 · waiting" without
   * a second request. Bookings that never arrived get `null`.
   */
  private async withQueueEntries<T extends Appointment>(
    appointments: T[],
  ): Promise<(T & { queueEntry: QueueEntrySummary | null })[]> {
    if (!appointments.length) return [];
    const rows = await sqlRows<{
      appointment_id: string;
      id: string;
      status: string;
      token_number: number;
      token_prefix: string;
      queue_session_id: string;
    }>(
      this.dataSource,
      `SELECT DISTINCT ON (e.appointment_id)
              e.appointment_id, e.id, e.status, e.token_number, s.token_prefix, e.queue_session_id
         FROM queue_entries e
         JOIN queue_sessions s ON s.id = e.queue_session_id
        WHERE e.appointment_id = ANY($1::uuid[])
        ORDER BY e.appointment_id, e.checked_in_at DESC`,
      [appointments.map((a) => a.id)],
    );
    const byAppt = new Map(rows.map((r) => [r.appointment_id, r]));
    return appointments.map((a) => {
      const r = byAppt.get(a.id);
      return Object.assign(a, {
        queueEntry: r
          ? {
              id: r.id,
              status: r.status,
              token: `${r.token_prefix}-${String(r.token_number).padStart(3, '0')}`,
              sessionId: r.queue_session_id,
            }
          : null,
      });
    });
  }

  /**
   * Get all doctors working at this location (for calendar columns)
   */
  async getDoctors(ctx: TenantContext) {
    const assignments = await this.assignmentRepo.find({
      where: {
        locationId: ctx.locationId,
        organizationId: ctx.organizationId,
        isActive: true,
      },
      relations: ['employee'],
    });

    return assignments
      .filter((a) => a.employee?.isActive)
      .map((a) => ({
        id: a.employee.id,
        fullName: a.employee.fullName,
        designation: a.designation,
        profilePictureUrl: a.employee.profilePictureUrl,
      }));
  }

  /**
   * Get appointment analytics/stats for a date range
   */
  async getStats(
    ctx: TenantContext,
    access: AccessContext,
    startDate?: string,
    endDate?: string,
  ) {
    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .select('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN a.status = '${AppointmentStatus.COMPLETED}' THEN 1 ELSE 0 END)`,
        'completed',
      )
      .addSelect(
        `SUM(CASE WHEN a.status = '${AppointmentStatus.CANCELLED}' THEN 1 ELSE 0 END)`,
        'cancelled',
      )
      .addSelect(
        `SUM(CASE WHEN a.status = '${AppointmentStatus.NO_SHOW}' THEN 1 ELSE 0 END)`,
        'noShow',
      )
      .addSelect(
        `SUM(CASE WHEN a.status IN ('${AppointmentStatus.SCHEDULED}', '${AppointmentStatus.CONFIRMED}') THEN 1 ELSE 0 END)`,
        'scheduled',
      )
      .addSelect(
        `SUM(CASE WHEN a.status = '${AppointmentStatus.CHECKED_IN}' THEN 1 ELSE 0 END)`,
        'checkedIn',
      )
      .where('a.location_id = :locationId', { locationId: ctx.locationId });
    access.applyScope(qb, 'appointments.view', APPOINTMENT_SCOPE);

    if (startDate) {
      qb.andWhere('a.start_time >= :startDate', {
        startDate: new Date(startDate),
      });
    }
    if (endDate) {
      qb.andWhere('a.start_time <= :endDate', { endDate: new Date(endDate) });
    }

    // Walk-ins, waiting and wait times come from the queue, not from bookings.
    const queueParams: unknown[] = [ctx.locationId];
    let queueRange = scopeSql(
      access,
      'appointments.view',
      SESSION_SCOPE,
      (v) => {
        queueParams.push(v);
        return `$${queueParams.length}`;
      },
    );
    if (startDate) {
      queueParams.push(new Date(startDate));
      queueRange += ` AND e.checked_in_at >= $${queueParams.length}`;
    }
    if (endDate) {
      queueParams.push(new Date(endDate));
      queueRange += ` AND e.checked_in_at <= $${queueParams.length}`;
    }
    const [raw, queueRows] = await Promise.all([
      qb.getRawOne<
        Record<
          | 'total'
          | 'completed'
          | 'cancelled'
          | 'noShow'
          | 'scheduled'
          | 'checkedIn',
          string | null
        >
      >(),
      sqlRows<{
        walk_ins: string | null;
        waiting: string | null;
        with_doctor: string | null;
        avg_wait_min: string | null;
      }>(
        this.dataSource,
        `SELECT
           COUNT(*) FILTER (WHERE e.queue_type = 'walk_in') AS walk_ins,
           COUNT(*) FILTER (WHERE e.status IN ('waiting', 'skipped', 'on_hold')) AS waiting,
           COUNT(*) FILTER (WHERE e.status IN ('called', 'in_consultation')) AS with_doctor,
           ROUND(AVG(EXTRACT(EPOCH FROM (e.consultation_started_at - e.checked_in_at)) / 60)
             FILTER (WHERE e.consultation_started_at IS NOT NULL)) AS avg_wait_min
         FROM queue_entries e
         JOIN queue_sessions s ON s.id = e.queue_session_id
        WHERE s.location_id = $1 ${queueRange}`,
        queueParams,
      ),
    ]);
    const queueRaw = queueRows.at(0);
    const int = (v: string | null | undefined) => parseInt(v ?? '0', 10) || 0;
    const total = int(raw?.total);
    const completed = int(raw?.completed);
    const noShow = int(raw?.noShow);

    return {
      total,
      completed,
      cancelled: int(raw?.cancelled),
      noShow,
      scheduled: int(raw?.scheduled),
      checkedIn: int(raw?.checkedIn),
      walkIns: int(queueRaw?.walk_ins),
      waiting: int(queueRaw?.waiting),
      inProgress: int(queueRaw?.with_doctor),
      avgWaitMinutes:
        queueRaw?.avg_wait_min == null ? null : Number(queueRaw.avg_wait_min),
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      noShowRate: total > 0 ? Math.round((noShow / total) * 100) : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 7. AVAILABILITY (for calendar background events)
  // ═══════════════════════════════════════════════════════════

  /**
   * Returns doctor working hour blocks for a date range, built on the
   * location's local calendar days and converted to UTC instants.
   * Used by FullCalendar to render business hours / background events.
   */
  async getAvailability(
    ctx: TenantContext,
    doctorId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    // Get all doctors at this location
    const doctors = await this.getDoctors(ctx);
    const targetDoctors = doctorId
      ? doctors.filter((d) => d.id === doctorId)
      : doctors;

    if (targetDoctors.length === 0) return [];

    // Get schedules for target doctors
    const doctorIds = targetDoctors.map((d) => d.id);
    const schedules = await this.scheduleRepo
      .createQueryBuilder('s')
      .where('s.employee_id IN (:...doctorIds)', { doctorIds })
      .andWhere('s.is_working = :isWorking', { isWorking: true })
      .andWhere('s.is_active = :isActive', { isActive: true })
      .getMany();

    // Build a map: doctorId -> dayOfWeek -> schedule
    const scheduleMap = new Map<string, Map<number, (typeof schedules)[0]>>();
    for (const s of schedules) {
      if (!scheduleMap.has(s.employeeId)) {
        scheduleMap.set(s.employeeId, new Map());
      }
      scheduleMap.get(s.employeeId)!.set(s.dayOfWeek, s);
    }

    // Walk the location-local days covered by the requested range
    const tz = await this.clock.timezoneFor(ctx.locationId);
    const now = this.clock.now();
    const rangeStart = startDate ? new Date(startDate) : now;
    const rangeEnd = endDate
      ? new Date(endDate)
      : new Date(rangeStart.getTime() + 7 * 86400000);
    const lastDay = this.clock.today(tz, rangeEnd);
    const blocks: AvailabilityBlock[] = [];

    for (
      let day = this.clock.today(tz, rangeStart);
      day <= lastDay;
      day = addDays(day, 1)
    ) {
      const dayOfWeek = dayOfWeekOf(day);

      for (const doc of targetDoctors) {
        const daySchedule = scheduleMap.get(doc.id)?.get(dayOfWeek);
        if (daySchedule && daySchedule.startTime && daySchedule.endTime) {
          blocks.push({
            doctorId: doc.id,
            doctorName: doc.fullName,
            start: this.clock.at(tz, day, daySchedule.startTime).toISOString(),
            end: this.clock.at(tz, day, daySchedule.endTime).toISOString(),
            dayOfWeek,
            slotDuration: daySchedule.slotDuration,
          });
        }
      }
    }

    return blocks;
  }

  /**
   * Save a booking. The database's `no_doctor_overlap` exclusion constraint
   * has the final say on double booking (two concurrent requests can both
   * pass the read check above): Postgres 23P01 → 409.
   */
  /**
   * `overrideRules` skips the doctor's working hours and the daily limit
   * (never the double-booking check — the DB constraint holds regardless).
   * Needs `appointments.override_rules`.
   */
  private overridesRules(
    requested: boolean | undefined,
    access: AccessContext | undefined,
  ): boolean {
    if (!requested) return false;
    if (!access?.can('appointments.override_rules')) {
      throw noPermission(['appointments.override_rules']);
    }
    return true;
  }

  private async saveBooking(appointment: Appointment): Promise<Appointment> {
    try {
      return await this.appointmentRepo.save(appointment);
    } catch (err) {
      if (pgError(err).code === '23P01') {
        throw new ConflictException({
          message: 'Doctor has a conflicting appointment during this time',
          code: 'DOCTOR_DOUBLE_BOOKED',
        });
      }
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE: DOCTOR + SCHEDULE VALIDATION
  // ═══════════════════════════════════════════════════════════

  private async assertDoctorAtLocation(
    ctx: TenantContext,
    doctorId: string,
  ): Promise<void> {
    const doctor = await this.employeeRepo.findOne({
      where: { id: doctorId, isActive: true },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found or is inactive');
    }

    const assignment = await this.assignmentRepo.findOne({
      where: {
        employeeId: doctorId,
        locationId: ctx.locationId,
        organizationId: ctx.organizationId,
        isActive: true,
      },
    });
    if (!assignment) {
      throw new BadRequestException('Doctor is not assigned to this location');
    }
  }

  /**
   * The slot must fit inside one of the doctor's working blocks for that
   * weekday. Weekday and "HH:MM" are read in the LOCATION's timezone.
   */
  private async validateSchedule(
    doctorId: string,
    startTime: Date,
    endTime: Date,
    tz: string,
  ): Promise<void> {
    const { dayOfWeek, hhmm: startHHMM } = this.clock.wallClock(tz, startTime);
    const endHHMM = this.endWallClock(tz, startTime, endTime);

    // Check if doctor has a working schedule for this day (ANY location)
    const schedules = await this.scheduleRepo.find({
      where: {
        employeeId: doctorId,
        dayOfWeek,
        isWorking: true,
        isActive: true,
      },
    });

    if (schedules.length === 0) {
      throw new BadRequestException(
        `Doctor does not work on ${this.dayName(dayOfWeek)}`,
      );
    }

    // Check if the requested time fits within any schedule
    const fitsSchedule = schedules.some((s) =>
      this.fitsBlock(s, startHHMM, endHHMM),
    );

    if (!fitsSchedule) {
      const availableRanges = schedules
        .map((s) => `${this.hhmm(s.startTime)} - ${this.hhmm(s.endTime)}`)
        .join(', ');
      throw new BadRequestException(
        `Requested time (${startHHMM}-${endHHMM}) is outside doctor's schedule. Available: ${availableRanges}`,
      );
    }
  }

  /** Postgres `time` comes back as "09:00:00"; compare on "HH:MM". */
  private hhmm(value: string | null): string {
    return (value ?? '').slice(0, 5);
  }

  private fitsBlock(
    s: EmployeeSchedule,
    startHHMM: string,
    endHHMM: string,
  ): boolean {
    if (!s.startTime || !s.endTime) return false;
    return (
      this.hhmm(s.startTime) <= startHHMM && this.hhmm(s.endTime) >= endHHMM
    );
  }

  /** End time of day; an end that lands on the next local day reads "24:00". */
  private endWallClock(tz: string, startTime: Date, endTime: Date): string {
    const sameDay =
      this.clock.today(tz, startTime) === this.clock.today(tz, endTime);
    const { hhmm } = this.clock.wallClock(tz, endTime);
    return sameDay ? hhmm : '24:00';
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE: DAILY LIMIT (location_settings.max_appointments_per_day)
  // ═══════════════════════════════════════════════════════════

  private async dailyLimitReason(
    ctx: TenantContext,
    startTime: Date,
    tz: string,
    excludeAppointmentId?: string,
  ): Promise<string | null> {
    const settings = await this.settingsRepo.findOne({
      where: { locationId: ctx.locationId },
    });
    const max = settings?.maxAppointmentsPerDay ?? 0;
    if (!max || max <= 0) return null;

    const day = this.clock.today(tz, startTime);
    const { start, end } = this.clock.dayRange(tz, day);
    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.location_id = :locationId', { locationId: ctx.locationId })
      .andWhere('a.start_time >= :start AND a.start_time < :end', {
        start,
        end,
      })
      .andWhere('a.status NOT IN (:...excluded)', {
        excluded: BLOCKING_EXCLUDED,
      });
    if (excludeAppointmentId) {
      qb.andWhere('a.id != :excludeId', { excludeId: excludeAppointmentId });
    }

    const count = await qb.getCount();
    return count >= max
      ? `Daily limit reached: this location takes at most ${max} bookings on ${day}`
      : null;
  }

  private async assertDailyLimit(
    ctx: TenantContext,
    startTime: Date,
    tz: string,
    excludeAppointmentId?: string,
  ): Promise<void> {
    const reason = await this.dailyLimitReason(
      ctx,
      startTime,
      tz,
      excludeAppointmentId,
    );
    if (reason) {
      throw new ConflictException({
        message: reason,
        code: 'DAILY_LIMIT_REACHED',
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE: GLOBAL CONFLICT CHECK
  // ═══════════════════════════════════════════════════════════

  private async checkGlobalConflict(
    doctorId: string,
    startTime: Date,
    endTime: Date,
    excludeAppointmentId?: string,
  ): Promise<void> {
    const conflict = await this.findConflict(
      doctorId,
      startTime,
      endTime,
      excludeAppointmentId,
    );
    if (conflict) {
      throw new ConflictException(
        'Doctor has a conflicting appointment during this time',
      );
    }
  }

  private async findConflict(
    doctorId: string,
    startTime: Date,
    endTime: Date,
    excludeAppointmentId?: string,
  ): Promise<Appointment | null> {
    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.doctor_id = :doctorId', { doctorId })
      .andWhere('a.start_time < :endTime', { endTime })
      .andWhere('a.end_time > :startTime', { startTime })
      .andWhere('a.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: BLOCKING_EXCLUDED,
      });

    if (excludeAppointmentId) {
      qb.andWhere('a.id != :excludeId', { excludeId: excludeAppointmentId });
    }

    return qb.getOne();
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE: SUGGEST NEXT FREE SLOT
  // ═══════════════════════════════════════════════════════════

  private async suggestNextSlot(
    doctorId: string,
    requestedStart: Date,
    duration: number,
    tz: string,
    excludeAppointmentId?: string,
  ): Promise<Date | null> {
    // Get all appointments for the doctor on that location-local day
    const day = this.clock.today(tz, requestedStart);
    const { start: dayStart, end: dayEnd } = this.clock.dayRange(tz, day);

    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.doctor_id = :doctorId', { doctorId })
      .andWhere('a.start_time >= :dayStart', { dayStart })
      .andWhere('a.start_time < :dayEnd', { dayEnd })
      .andWhere('a.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: BLOCKING_EXCLUDED,
      })
      .orderBy('a.startTime', 'ASC');

    if (excludeAppointmentId) {
      qb.andWhere('a.id != :excludeId', { excludeId: excludeAppointmentId });
    }

    const appointments = await qb.getMany();

    // Get doctor's schedule for this day
    const dayOfWeek = dayOfWeekOf(day);
    const schedules = await this.scheduleRepo.find({
      where: {
        employeeId: doctorId,
        dayOfWeek,
        isWorking: true,
        isActive: true,
      },
    });

    if (schedules.length === 0) return null;

    // Try each gap after the requested time
    let candidate = new Date(requestedStart);

    for (let attempt = 0; attempt < 50; attempt++) {
      const candidateEnd = new Date(candidate.getTime() + duration * 60000);

      // Check it fits within any schedule
      const candidateHHMM = this.clock.wallClock(tz, candidate).hhmm;
      const candidateEndHHMM = this.endWallClock(tz, candidate, candidateEnd);
      const fitsSchedule = schedules.some((s) =>
        this.fitsBlock(s, candidateHHMM, candidateEndHHMM),
      );

      if (!fitsSchedule) break; // Past schedule, no more slots today

      // Check for conflict
      const conflicting = appointments.find(
        (a) => a.startTime < candidateEnd && a.endTime > candidate,
      );

      if (!conflicting) {
        return candidate;
      }

      // Move to the end of the conflicting appointment
      candidate = new Date(conflicting.endTime);
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  private dayName(day: number): string {
    return [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ][day];
  }
}
