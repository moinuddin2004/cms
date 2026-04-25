import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan, Not, In } from 'typeorm';
import { Appointment } from './entities/appointment.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { EmployeeSchedule } from 'src/employees/entities/employee-schedule.entity';
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

    // 8. Save appointment
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
    if (appt.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed appointment');
    }

    appt.status = AppointmentStatus.CANCELLED;
    appt.cancelReason = dto.reason || null;
    appt.updatedBy = userId;

    await this.appointmentRepo.save(appt);
    return this.findOne(id, ctx);
  }

  async noShow(id: string, ctx: TenantContext, userId: string): Promise<Appointment> {
    const appt = await this.appointmentRepo.findOne({
      where: { id, locationId: ctx.locationId },
    });
    if (!appt) throw new NotFoundException('Appointment not found');

    appt.status = AppointmentStatus.NO_SHOW;
    appt.updatedBy = userId;

    await this.appointmentRepo.save(appt);
    return this.findOne(id, ctx);
  }

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

    appt.status = AppointmentStatus.IN_PROGRESS;
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
    appt.updatedBy = userId;

    await this.appointmentRepo.save(appt);
    return this.findOne(id, ctx);
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
      .where('a.location_id = :locationId', { locationId: ctx.locationId });

    if (startDate) {
      qb.andWhere('a.start_time >= :startDate', {
        startDate: new Date(startDate),
      });
    }
    if (endDate) {
      qb.andWhere('a.start_time <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    const appointments = await qb.getMany();

    const total = appointments.length;
    const completed = appointments.filter(
      (a) => a.status === AppointmentStatus.COMPLETED,
    ).length;
    const cancelled = appointments.filter(
      (a) => a.status === AppointmentStatus.CANCELLED,
    ).length;
    const noShow = appointments.filter(
      (a) => a.status === AppointmentStatus.NO_SHOW,
    ).length;
    const scheduled = appointments.filter(
      (a) =>
        a.status === AppointmentStatus.SCHEDULED ||
        a.status === AppointmentStatus.CONFIRMED ||
        a.status === AppointmentStatus.RESCHEDULED,
    ).length;
    const inProgress = appointments.filter(
      (a) => a.status === AppointmentStatus.IN_PROGRESS,
    ).length;

    return {
      total,
      completed,
      cancelled,
      noShow,
      scheduled,
      inProgress,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      noShowRate: total > 0 ? Math.round((noShow / total) * 100) : 0,
    };
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
