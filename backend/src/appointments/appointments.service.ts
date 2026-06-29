import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  LessThan,
  MoreThan,
  Not,
  In,
  DataSource,
} from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { AppointmentTokenCounter } from './entities/appointment-token-counter.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { EmployeeSchedule } from 'src/employees/entities/employee-schedule.entity';
import { Location } from 'src/locations/entities/location.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateWalkInDto } from './dto/create-walk-in.dto';
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
import { EncountersService } from 'src/encounters/encounters.service';

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
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    private readonly dataSource: DataSource,
    private readonly encountersService: EncountersService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // 1. CREATE APPOINTMENT
  // ═══════════════════════════════════════════════════════════

  async create(
    ctx: TenantContext,
    dto: CreateAppointmentDto,
    userId: string,
  ): Promise<Appointment> {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(startTime.getTime() + dto.duration * 60000);

    // 1. Validate start_time is not in the past
    if (!dto.isWalkIn && startTime < new Date()) {
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

    // 4. Validate doctor exists and is active
    const doctor = await this.employeeRepo.findOne({
      where: { id: dto.doctorId, isActive: true },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor not found or is inactive');
    }

    // 5. Validate doctor belongs to this location
    const assignment = await this.assignmentRepo.findOne({
      where: {
        employeeId: dto.doctorId,
        locationId: ctx.locationId,
        organizationId: ctx.organizationId,
        isActive: true,
      },
    });
    if (!assignment) {
      throw new BadRequestException(
        'Doctor is not assigned to this location',
      );
    }

    // 6. Check GLOBAL schedule validity
    await this.validateSchedule(dto.doctorId, startTime, endTime);

    // 7. Check GLOBAL appointment conflict
    await this.checkGlobalConflict(dto.doctorId, startTime, endTime);

    // 8. Save appointment. NOTE: a booked appointment gets NO token at booking
    //    time — the token is assigned atomically when the patient checks in
    //    and physically arrives (see checkIn()). This keeps token order = the
    //    order people actually walk through the door.
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
      tokenNumber: null,
      reasonForVisit: dto.reasonForVisit || null,
      isWalkIn: dto.isWalkIn || false,
      isEmergency: dto.isEmergency || false,
      notes: dto.notes || null,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.appointmentRepo.save(appointment);

    return this.findOne(saved.id, ctx);
  }

  // ═══════════════════════════════════════════════════════════
  // 1b. WALK-IN — instant check-in with token, no schedule/conflict checks
  // ═══════════════════════════════════════════════════════════

  /**
   * Create a walk-in appointment. A walk-in IS a check-in: the patient is
   * already at the desk, so we skip schedule/conflict validation, assign a
   * token immediately, and land directly in CHECKED_IN (waiting).
   *
   * Accepts either an existing `patientId` or `{ patientName, patientPhone }`
   * for an inline quick-create.
   */
  async createWalkIn(
    ctx: TenantContext,
    dto: CreateWalkInDto,
    userId: string,
  ): Promise<Appointment> {
    // 1. Resolve / create the patient
    let patientId = dto.patientId ?? null;
    if (!patientId) {
      if (!dto.patientName || !dto.patientPhone) {
        throw new BadRequestException(
          'Provide an existing patientId, or patientName + patientPhone to create one',
        );
      }
      const created = await this.quickCreatePatient(
        ctx,
        dto.patientName,
        dto.patientPhone,
        userId,
      );
      patientId = created.id;
    } else {
      const patient = await this.patientRepo.findOne({
        where: { id: patientId, organizationId: ctx.organizationId },
      });
      if (!patient) throw new NotFoundException('Patient not found');
    }

    // 2. Guard against a duplicate active token today (unless forced).
    if (!dto.force) {
      const active = await this.findActiveTodayForPatient(ctx, patientId);
      if (active) {
        throw new ConflictException({
          message: `${active.patient?.fullName ?? 'This patient'} already has an active token today: ${this.tokenDisplay(active)}`,
          code: 'DUPLICATE_ACTIVE_APPOINTMENT',
          appointmentId: active.id,
          token: this.tokenDisplay(active),
        });
      }
    }

    // 3. Optional doctor — validate it belongs to the location if provided.
    if (dto.doctorId) {
      const assignment = await this.assignmentRepo.findOne({
        where: {
          employeeId: dto.doctorId,
          locationId: ctx.locationId,
          organizationId: ctx.organizationId,
          isActive: true,
        },
      });
      if (!assignment) {
        throw new BadRequestException('Doctor is not assigned to this location');
      }
    }

    // 4. Assign token + build the row already CHECKED_IN.
    const now = new Date();
    const token = await this.assignToken(ctx);
    const duration = dto.duration ?? 15;

    const appointment = this.appointmentRepo.create({
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
      patientId,
      doctorId: dto.doctorId ?? null,
      type: dto.type || AppointmentType.CONSULTATION,
      status: AppointmentStatus.CHECKED_IN,
      startTime: now,
      endTime: new Date(now.getTime() + duration * 60000),
      durationMinutes: duration,
      tokenNumber: token.number,
      tokenPrefix: token.prefix,
      reasonForVisit: dto.reasonForVisit || null,
      isWalkIn: true,
      isEmergency: dto.isEmergency || false,
      notes: dto.notes || null,
      checkedInAt: now,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.appointmentRepo.save(appointment);
    // Walk-ins arrive already CHECKED_IN (they skip checkIn) → create the encounter.
    await this.encountersService.ensureEncounterForAppointment(ctx, saved, userId);
    return this.findOne(saved.id, ctx);
  }

  // ═══════════════════════════════════════════════════════════
  // TOKEN ASSIGNMENT (atomic, per org+location+local-day)
  // ═══════════════════════════════════════════════════════════

  /**
   * Atomically allocate the next token for the active location today. Uses an
   * upsert with `RETURNING` so concurrent check-ins can never collide on a
   * number. Returns the raw counter value plus the location's display prefix.
   */
  private async assignToken(
    ctx: TenantContext,
  ): Promise<{ number: number; prefix: string }> {
    const location = await this.locationRepo.findOne({
      where: { id: ctx.locationId },
    });
    const day = this.localDay(location?.timezone);
    const prefix = this.resolveTokenPrefix(location);

    const rows = await this.dataSource.query(
      `INSERT INTO appointment_token_counters
         (id, organization_id, location_id, day, last_number, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 1, now())
       ON CONFLICT (organization_id, location_id, day)
       DO UPDATE SET last_number = appointment_token_counters.last_number + 1,
                     updated_at = now()
       RETURNING last_number`,
      [ctx.organizationId, ctx.locationId, day],
    );

    const number = Number(rows?.[0]?.last_number ?? 1);
    return { number, prefix };
  }

  private resolveTokenPrefix(location: Location | null): string {
    const raw = location?.tokenPrefix || location?.code || 'T';
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'T';
  }

  /** "KHI-007" style label, or "—" when no token has been assigned yet. */
  private tokenDisplay(appt: Appointment): string {
    if (appt.tokenNumber == null) return '—';
    const prefix = appt.tokenPrefix || 'T';
    return `${prefix}-${String(appt.tokenNumber).padStart(3, '0')}`;
  }

  /** Location-local "YYYY-MM-DD" so token days don't drift across timezones. */
  private localDay(timezone?: string | null): string {
    const tz = timezone || 'UTC';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      return new Intl.DateTimeFormat('en-CA').format(new Date());
    }
  }

  private async quickCreatePatient(
    ctx: TenantContext,
    fullName: string,
    phone: string,
    userId: string,
  ): Promise<Patient> {
    const count = await this.patientRepo.count({
      where: { organizationId: ctx.organizationId },
      withDeleted: true,
    });
    const patientNumber = `P-${String(count + 1).padStart(5, '0')}`;
    const patient = this.patientRepo.create({
      organizationId: ctx.organizationId,
      patientNumber,
      fullName: fullName.trim(),
      phone: phone.trim(),
      primaryLocationId: ctx.locationId,
      createdBy: userId,
    });
    return this.patientRepo.save(patient);
  }

  private async findActiveTodayForPatient(
    ctx: TenantContext,
    patientId: string,
  ): Promise<Appointment | null> {
    const { dayStart, dayEnd } = this.serverDayRange(new Date());
    return this.appointmentRepo.findOne({
      where: {
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
        patientId,
        startTime: Between(dayStart, dayEnd),
        status: In([
          AppointmentStatus.SCHEDULED,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.RESCHEDULED,
          AppointmentStatus.CHECKED_IN,
          AppointmentStatus.IN_PROGRESS,
        ]),
      },
      relations: ['patient'],
    });
  }

  private serverDayRange(forDate: Date): { dayStart: Date; dayEnd: Date } {
    const dayStart = new Date(forDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(forDate);
    dayEnd.setHours(23, 59, 59, 999);
    return { dayStart, dayEnd };
  }

  // ═══════════════════════════════════════════════════════════
  // 2. VALIDATE ENDPOINT (Real-time)
  // ═══════════════════════════════════════════════════════════

  async validate(
    ctx: TenantContext,
    dto: ValidateAppointmentDto,
  ): Promise<ValidationResult> {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(startTime.getTime() + dto.duration * 60000);

    // Check doctor exists and is active
    const doctor = await this.employeeRepo.findOne({
      where: { id: dto.doctorId, isActive: true },
    });
    if (!doctor) {
      return { valid: false, reason: 'Doctor not found or is inactive' };
    }

    // Check doctor belongs to location
    const assignment = await this.assignmentRepo.findOne({
      where: {
        employeeId: dto.doctorId,
        locationId: ctx.locationId,
        organizationId: ctx.organizationId,
        isActive: true,
      },
    });
    if (!assignment) {
      return {
        valid: false,
        reason: 'Doctor is not assigned to this location',
      };
    }

    // Check schedule
    try {
      await this.validateSchedule(dto.doctorId, startTime, endTime);
    } catch (e) {
      return {
        valid: false,
        reason: e.message || 'Outside doctor schedule',
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

    return { valid: true };
  }

  // ═══════════════════════════════════════════════════════════
  // 3. UPDATE / RESCHEDULE
  // ═══════════════════════════════════════════════════════════

  async update(
    id: string,
    ctx: TenantContext,
    dto: UpdateAppointmentDto,
    userId: string,
  ): Promise<Appointment> {
    const existing = await this.appointmentRepo.findOne({
      where: { id, locationId: ctx.locationId },
    });
    if (!existing) {
      throw new NotFoundException('Appointment not found');
    }

    if (
      existing.status === AppointmentStatus.CANCELLED ||
      existing.status === AppointmentStatus.COMPLETED
    ) {
      throw new BadRequestException(
        'Cannot update a cancelled or completed appointment',
      );
    }

    const doctorId = dto.doctorId || existing.doctorId;
    const duration = dto.duration || existing.durationMinutes;
    const startTime = dto.startTime
      ? new Date(dto.startTime)
      : existing.startTime;
    const endTime = new Date(startTime.getTime() + duration * 60000);

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
    if (dto.doctorId && dto.doctorId !== existing.doctorId) {
      const doctor = await this.employeeRepo.findOne({
        where: { id: dto.doctorId, isActive: true },
      });
      if (!doctor) {
        throw new NotFoundException('Doctor not found or is inactive');
      }
      const assignment = await this.assignmentRepo.findOne({
        where: {
          employeeId: dto.doctorId,
          locationId: ctx.locationId,
          organizationId: ctx.organizationId,
          isActive: true,
        },
      });
      if (!assignment) {
        throw new BadRequestException(
          'Doctor is not assigned to this location',
        );
      }
    }

    // Re-run schedule + conflict checks (excluding current appointment)
    if (dto.startTime || dto.duration || dto.doctorId) {
      await this.validateSchedule(doctorId!, startTime, endTime);
      await this.checkGlobalConflict(doctorId!, startTime, endTime, id);
    }

    // Update fields
    if (dto.patientId) existing.patientId = dto.patientId;
    if (dto.doctorId) existing.doctorId = dto.doctorId;
    if (dto.type) existing.type = dto.type;
    if (dto.notes !== undefined) existing.notes = dto.notes || null;
    if (dto.startTime || dto.duration) {
      existing.startTime = startTime;
      existing.endTime = endTime;
      existing.durationMinutes = duration;
      // Mark as rescheduled if time changed
      if (dto.startTime) {
        existing.status = AppointmentStatus.RESCHEDULED;
      }
    }
    existing.updatedBy = userId;

    await this.appointmentRepo.save(existing);
    return this.findOne(id, ctx);
  }

  // ═══════════════════════════════════════════════════════════
  // 4. STATUS TRANSITIONS
  // ═══════════════════════════════════════════════════════════

  async cancel(
    id: string,
    ctx: TenantContext,
    dto: CancelAppointmentDto,
    userId: string,
  ): Promise<Appointment> {
    const appt = await this.appointmentRepo.findOne({
      where: { id, locationId: ctx.locationId },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    if (await this.encountersService.hasEncounterForAppointment(ctx, id)) {
      throw new BadRequestException(
        'Cannot cancel — the patient has already visited (an encounter exists)',
      );
    }
    if (appt.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed appointment');
    }
    if (appt.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled');
    }

    appt.status = AppointmentStatus.CANCELLED;
    appt.cancelReasonCode = dto.reasonCode || null;
    appt.cancelReason = dto.reason || null;
    appt.cancelledAt = new Date();
    appt.updatedBy = userId;

    await this.appointmentRepo.save(appt);
    return this.findOne(id, ctx);
  }

  async noShow(id: string, ctx: TenantContext, userId: string): Promise<Appointment> {
    const appt = await this.appointmentRepo.findOne({
      where: { id, locationId: ctx.locationId },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    if (await this.encountersService.hasEncounterForAppointment(ctx, id)) {
      throw new BadRequestException(
        'Cannot mark no-show — the patient has already visited (an encounter exists)',
      );
    }

    appt.status = AppointmentStatus.NO_SHOW;
    appt.updatedBy = userId;

    await this.appointmentRepo.save(appt);
    return this.findOne(id, ctx);
  }

  /**
   * Receptionist marks an arrived patient. Generates the daily token (atomic)
   * and moves SCHEDULED/CONFIRMED/RESCHEDULED → CHECKED_IN (waiting). The
   * doctor later picks them up via start().
   */
  async checkIn(id: string, ctx: TenantContext, userId: string): Promise<Appointment> {
    const appt = await this.appointmentRepo.findOne({
      where: { id, locationId: ctx.locationId },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    if (
      appt.status !== AppointmentStatus.SCHEDULED &&
      appt.status !== AppointmentStatus.CONFIRMED &&
      appt.status !== AppointmentStatus.RESCHEDULED
    ) {
      throw new BadRequestException(
        `Cannot check in from status: ${appt.status}`,
      );
    }

    // Assign a token only if one wasn't already issued (idempotent-ish).
    if (appt.tokenNumber == null) {
      const token = await this.assignToken(ctx);
      appt.tokenNumber = token.number;
      appt.tokenPrefix = token.prefix;
    }
    appt.status = AppointmentStatus.CHECKED_IN;
    appt.checkedInAt = new Date();
    appt.updatedBy = userId;

    await this.appointmentRepo.save(appt);
    // Patient has physically arrived → create the encounter (idempotent).
    await this.encountersService.ensureEncounterForAppointment(ctx, appt, userId);
    return this.findOne(id, ctx);
  }

  /**
   * Doctor starts the consultation: CHECKED_IN → IN_PROGRESS ("in room").
   * Enforces one in-room patient per doctor at a time.
   */
  async start(id: string, ctx: TenantContext, userId: string): Promise<Appointment> {
    const appt = await this.appointmentRepo.findOne({
      where: { id, locationId: ctx.locationId },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    if (appt.status !== AppointmentStatus.CHECKED_IN) {
      throw new BadRequestException(
        `Only checked-in patients can be started (current: ${appt.status})`,
      );
    }

    if (appt.doctorId) {
      const busy = await this.appointmentRepo.findOne({
        where: {
          locationId: ctx.locationId,
          doctorId: appt.doctorId,
          status: AppointmentStatus.IN_PROGRESS,
          id: Not(id),
        },
      });
      if (busy) {
        throw new ConflictException(
          'This doctor already has a patient in the room. Complete the current one first.',
        );
      }
    }

    appt.status = AppointmentStatus.IN_PROGRESS;
    appt.inRoomAt = new Date();
    appt.updatedBy = userId;

    await this.appointmentRepo.save(appt);
    return this.findOne(id, ctx);
  }

  async complete(id: string, ctx: TenantContext, userId: string): Promise<Appointment> {
    const appt = await this.appointmentRepo.findOne({
      where: { id, locationId: ctx.locationId },
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    if (appt.status !== AppointmentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Only in-progress appointments can be completed',
      );
    }

    appt.status = AppointmentStatus.COMPLETED;
    appt.completedAt = new Date();
    appt.updatedBy = userId;

    await this.appointmentRepo.save(appt);
    // Safety net — ensure an encounter exists for the completed visit.
    await this.encountersService.ensureEncounterForAppointment(ctx, appt, userId);
    return this.findOne(id, ctx);
  }

  // ═══════════════════════════════════════════════════════════
  // TODAY'S QUEUE
  // ═══════════════════════════════════════════════════════════

  /**
   * The single-screen queue for one day at the active location: every status
   * in one flat list, sorted by token (FIFO of arrivals) with not-yet-arrived
   * bookings after the tokened rows. `date` is the client's local "YYYY-MM-DD"
   * (defaults to server-local today).
   */
  async getQueue(ctx: TenantContext, date?: string): Promise<Appointment[]> {
    const base = date ? this.parseDay(date) : new Date();
    const { dayStart, dayEnd } = this.serverDayRange(base);

    return this.appointmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patient', 'patient')
      .leftJoinAndSelect('a.doctor', 'doctor')
      .where('a.location_id = :locationId', { locationId: ctx.locationId })
      .andWhere('a.start_time >= :dayStart', { dayStart })
      .andWhere('a.start_time <= :dayEnd', { dayEnd })
      .orderBy('a.token_number', 'ASC', 'NULLS LAST')
      .addOrderBy('a.start_time', 'ASC')
      .getMany();
  }

  private parseDay(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }

  async confirm(id: string, ctx: TenantContext, userId: string): Promise<Appointment> {
    const appt = await this.appointmentRepo.findOne({
      where: { id, locationId: ctx.locationId },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    appt.status = AppointmentStatus.CONFIRMED;
    appt.updatedBy = userId;

    await this.appointmentRepo.save(appt);
    return this.findOne(id, ctx);
  }

  // ═══════════════════════════════════════════════════════════
  // 5. QUERIES
  // ═══════════════════════════════════════════════════════════

  async findAll(ctx: TenantContext, filters: AppointmentFilterDto) {
    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patient', 'patient')
      .leftJoinAndSelect('a.doctor', 'doctor')
      .leftJoinAndSelect('a.location', 'location')
      .where('a.location_id = :locationId', { locationId: ctx.locationId });

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
      // ILIKE across the joined patient row plus the token number. Casting
      // token_number to text lets the same input match "5", "005", "12" etc.
      // alongside patient name / phone / patient number.
      qb.andWhere(
        `(
          patient.full_name ILIKE :search
          OR patient.phone ILIKE :search
          OR patient.patient_number ILIKE :search
          OR CAST(a.token_number AS text) ILIKE :search
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

    return { data, total, page, limit };
  }

  async findOne(id: string, ctx: TenantContext): Promise<Appointment> {
    const appt = await this.appointmentRepo.findOne({
      where: { id, locationId: ctx.locationId },
      relations: ['patient', 'doctor', 'location'],
    });
    if (!appt) throw new NotFoundException('Appointment not found');
    return appt;
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
  async getStats(ctx: TenantContext, startDate?: string, endDate?: string) {
    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .select('COUNT(*)', 'total')
      .addSelect(`SUM(CASE WHEN a.status = '${AppointmentStatus.COMPLETED}' THEN 1 ELSE 0 END)`, 'completed')
      .addSelect(`SUM(CASE WHEN a.status = '${AppointmentStatus.CANCELLED}' THEN 1 ELSE 0 END)`, 'cancelled')
      .addSelect(`SUM(CASE WHEN a.status = '${AppointmentStatus.NO_SHOW}' THEN 1 ELSE 0 END)`, 'noShow')
      .addSelect(`SUM(CASE WHEN a.status IN ('${AppointmentStatus.SCHEDULED}', '${AppointmentStatus.CONFIRMED}', '${AppointmentStatus.RESCHEDULED}') THEN 1 ELSE 0 END)`, 'scheduled')
      .addSelect(`SUM(CASE WHEN a.status = '${AppointmentStatus.CHECKED_IN}' THEN 1 ELSE 0 END)`, 'waiting')
      .addSelect(`SUM(CASE WHEN a.status = '${AppointmentStatus.IN_PROGRESS}' THEN 1 ELSE 0 END)`, 'inProgress')
      .where('a.location_id = :locationId', { locationId: ctx.locationId });

    if (startDate) {
      qb.andWhere('a.start_time >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      qb.andWhere('a.start_time <= :endDate', { endDate: new Date(endDate) });
    }

    const raw = await qb.getRawOne();
    const total = parseInt(raw.total, 10) || 0;
    const completed = parseInt(raw.completed, 10) || 0;
    const cancelled = parseInt(raw.cancelled, 10) || 0;
    const noShow = parseInt(raw.noShow, 10) || 0;
    const scheduled = parseInt(raw.scheduled, 10) || 0;
    const waiting = parseInt(raw.waiting, 10) || 0;
    const inProgress = parseInt(raw.inProgress, 10) || 0;

    return {
      total, completed, cancelled, noShow, scheduled, waiting, inProgress,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      noShowRate: total > 0 ? Math.round((noShow / total) * 100) : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 7. AVAILABILITY (for calendar background events)
  // ═══════════════════════════════════════════════════════════

  /**
   * Returns doctor working hour blocks for a date range.
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
    const scheduleMap = new Map<string, Map<number, typeof schedules[0]>>();
    for (const s of schedules) {
      if (!scheduleMap.has(s.employeeId)) {
        scheduleMap.set(s.employeeId, new Map());
      }
      scheduleMap.get(s.employeeId)!.set(s.dayOfWeek, s);
    }

    // Generate availability blocks for the date range
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate
      ? new Date(endDate)
      : new Date(start.getTime() + 7 * 86400000);
    const blocks: any[] = [];

    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    while (current <= end) {
      const dayOfWeek = current.getDay();

      for (const doc of targetDoctors) {
        const daySchedule = scheduleMap.get(doc.id)?.get(dayOfWeek);
        if (daySchedule && daySchedule.startTime && daySchedule.endTime) {
          const [sh, sm] = daySchedule.startTime.split(':').map(Number);
          const [eh, em] = daySchedule.endTime.split(':').map(Number);

          const blockStart = new Date(current);
          blockStart.setHours(sh, sm, 0, 0);

          const blockEnd = new Date(current);
          blockEnd.setHours(eh, em, 0, 0);

          blocks.push({
            doctorId: doc.id,
            doctorName: doc.fullName,
            start: blockStart.toISOString(),
            end: blockEnd.toISOString(),
            dayOfWeek,
            slotDuration: daySchedule.slotDuration,
          });
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return blocks;
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE: SCHEDULE VALIDATION
  // ═══════════════════════════════════════════════════════════

  private async validateSchedule(
    doctorId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<void> {
    const dayOfWeek = startTime.getDay(); // 0=Sunday
    const startHHMM = this.toTimeString(startTime);
    const endHHMM = this.toTimeString(endTime);

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
    const fitsSchedule = schedules.some((s) => {
      return s.startTime! <= startHHMM && s.endTime! >= endHHMM;
    });

    if (!fitsSchedule) {
      const availableRanges = schedules
        .map((s) => `${s.startTime} - ${s.endTime}`)
        .join(', ');
      throw new BadRequestException(
        `Requested time (${startHHMM}-${endHHMM}) is outside doctor's schedule. Available: ${availableRanges}`,
      );
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
        excludedStatuses: [
          AppointmentStatus.CANCELLED,
          AppointmentStatus.NO_SHOW,
        ],
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
    excludeAppointmentId?: string,
  ): Promise<Date | null> {
    // Get all appointments for the doctor on that day
    const dayStart = new Date(requestedStart);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(requestedStart);
    dayEnd.setHours(23, 59, 59, 999);

    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .where('a.doctor_id = :doctorId', { doctorId })
      .andWhere('a.start_time >= :dayStart', { dayStart })
      .andWhere('a.start_time <= :dayEnd', { dayEnd })
      .andWhere('a.status NOT IN (:...excludedStatuses)', {
        excludedStatuses: [
          AppointmentStatus.CANCELLED,
          AppointmentStatus.NO_SHOW,
        ],
      })
      .orderBy('a.startTime', 'ASC');

    if (excludeAppointmentId) {
      qb.andWhere('a.id != :excludeId', { excludeId: excludeAppointmentId });
    }

    const appointments = await qb.getMany();

    // Get doctor's schedule for this day
    const dayOfWeek = requestedStart.getDay();
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
      const candidateEnd = new Date(
        candidate.getTime() + duration * 60000,
      );

      // Check it fits within any schedule
      const candidateHHMM = this.toTimeString(candidate);
      const candidateEndHHMM = this.toTimeString(candidateEnd);
      const fitsSchedule = schedules.some(
        (s) => s.startTime! <= candidateHHMM && s.endTime! >= candidateEndHHMM,
      );

      if (!fitsSchedule) break; // Past schedule, no more slots today

      // Check for conflict
      const hasConflict = appointments.some(
        (a) => a.startTime < candidateEnd && a.endTime > candidate,
      );

      if (!hasConflict) {
        return candidate;
      }

      // Move to the end of the conflicting appointment
      const conflicting = appointments.find(
        (a) => a.startTime < candidateEnd && a.endTime > candidate,
      );
      if (conflicting) {
        candidate = new Date(conflicting.endTime);
      } else {
        candidate = new Date(candidate.getTime() + 15 * 60000); // Jump 15 min
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  private toTimeString(date: Date): string {
    return date.toTimeString().slice(0, 5); // "HH:MM"
  }

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
