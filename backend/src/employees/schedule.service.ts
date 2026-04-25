import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { EmployeeSchedule } from './entities/employee-schedule.entity';
import { EmployeeOrgLocationAssignment } from './entities/employee-org-location-assignment.entity';
import { SetScheduleDto } from './dto/schedule/set-schedule.dto';
import { ScheduleDayDto } from './dto/schedule/schedule-day.dto';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(EmployeeSchedule)
    private readonly scheduleRepo: Repository<EmployeeSchedule>,
    @InjectRepository(EmployeeOrgLocationAssignment)
    private readonly assignmentRepo: Repository<EmployeeOrgLocationAssignment>,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // VERIFY ASSIGNMENT
  // ═══════════════════════════════════════════════════════════

  private async verifyAssignment(
    employeeId: string,
    ctx: TenantContext,
  ): Promise<void> {
    const assignment = await this.assignmentRepo.findOne({
      where: {
        employeeId,
        locationId: ctx.locationId,
        organizationId: ctx.organizationId,
        isActive: true,
      },
    });
    if (!assignment) {
      throw new BadRequestException(
        'Employee is not assigned to this location',
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SET SCHEDULE (full 7-day save)
  // ═══════════════════════════════════════════════════════════

  async setSchedule(
    employeeId: string,
    dto: SetScheduleDto,
    ctx: TenantContext,
    userId: string,
  ): Promise<EmployeeSchedule[]> {
    // 1. Verify assignment exists
    await this.verifyAssignment(employeeId, ctx);

    // 2. Validate: exactly 7 entries, days 0-6, no duplicates
    const days = dto.schedule.map((d) => d.dayOfWeek);
    const uniqueDays = new Set(days);
    if (uniqueDays.size !== 7) {
      throw new BadRequestException(
        'Schedule must contain exactly 7 unique days (0-6)',
      );
    }
    for (let i = 0; i <= 6; i++) {
      if (!uniqueDays.has(i)) {
        throw new BadRequestException(`Missing dayOfWeek: ${i}`);
      }
    }

    // 3. Validate working day times
    for (const day of dto.schedule) {
      if (day.isWorking) {
        if (!day.startTime || !day.endTime) {
          throw new BadRequestException(
            `Day ${day.dayOfWeek}: Start and end time required for working days`,
          );
        }
        const [sh, sm] = day.startTime.split(':').map(Number);
        const [eh, em] = day.endTime.split(':').map(Number);
        if (eh * 60 + em <= sh * 60 + sm) {
          throw new BadRequestException(
            `Day ${day.dayOfWeek}: End time must be after start time`,
          );
        }
      }
    }

    // 4. Upsert each day
    const results = await Promise.all(
      dto.schedule.map((day) =>
        this.upsertDay(employeeId, day, dto.slotDuration, ctx, userId),
      ),
    );

    // 5. Return sorted by dayOfWeek
    return results.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }

  // ═══════════════════════════════════════════════════════════
  // GET SCHEDULE
  // ═══════════════════════════════════════════════════════════

  async getSchedule(
    employeeId: string,
    ctx: TenantContext,
  ): Promise<EmployeeSchedule[]> {
    // 1. Verify assignment
    await this.verifyAssignment(employeeId, ctx);

    // 2. Find existing records
    const records = await this.scheduleRepo.find({
      where: {
        employeeId,
        locationId: ctx.locationId,
        isActive: true,
      },
      order: { dayOfWeek: 'ASC' },
    });

    // 3. Fill missing days with defaults
    const recordMap = new Map(records.map((r) => [r.dayOfWeek, r]));
    const fullSchedule: any[] = [];

    for (let i = 0; i <= 6; i++) {
      if (recordMap.has(i)) {
        fullSchedule.push(recordMap.get(i));
      } else {
        fullSchedule.push({
          dayOfWeek: i,
          isWorking: false,
          startTime: null,
          endTime: null,
          slotDuration: 30,
        });
      }
    }

    return fullSchedule;
  }

  // ═══════════════════════════════════════════════════════════
  // UPDATE SINGLE DAY
  // ═══════════════════════════════════════════════════════════

  async updateDay(
    employeeId: string,
    dayOfWeek: number,
    dto: ScheduleDayDto,
    ctx: TenantContext,
    userId: string,
  ): Promise<EmployeeSchedule> {
    await this.verifyAssignment(employeeId, ctx);

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      throw new BadRequestException('dayOfWeek must be 0-6');
    }

    // Validate times if working
    if (dto.isWorking) {
      if (!dto.startTime || !dto.endTime) {
        throw new BadRequestException(
          'Start and end time required for working days',
        );
      }
      const [sh, sm] = dto.startTime.split(':').map(Number);
      const [eh, em] = dto.endTime.split(':').map(Number);
      if (eh * 60 + em <= sh * 60 + sm) {
        throw new BadRequestException('End time must be after start time');
      }
    }

    return this.upsertDay(
      employeeId,
      { ...dto, dayOfWeek },
      undefined,
      ctx,
      userId,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // CROSS-LOCATION CONFLICT CHECK
  // ═══════════════════════════════════════════════════════════

  async checkCrossLocationConflict(
    employeeId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeLocationId: string,
  ): Promise<{ hasConflict: boolean; conflictingLocation?: string }> {
    const conflicts = await this.scheduleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.location', 'loc')
      .where('s.employee_id = :employeeId', { employeeId })
      .andWhere('s.day_of_week = :dayOfWeek', { dayOfWeek })
      .andWhere('s.is_working = true')
      .andWhere('s.location_id != :excludeLocationId', { excludeLocationId })
      .andWhere('s.start_time < :endTime', { endTime })
      .andWhere('s.end_time > :startTime', { startTime })
      .getMany();

    if (conflicts.length > 0) {
      return {
        hasConflict: true,
        conflictingLocation: conflicts[0]?.location?.name || 'Another location',
      };
    }

    return { hasConflict: false };
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE: UPSERT DAY
  // ═══════════════════════════════════════════════════════════

  private async upsertDay(
    employeeId: string,
    day: ScheduleDayDto,
    slotDuration: number | undefined,
    ctx: TenantContext,
    userId: string,
  ): Promise<EmployeeSchedule> {
    const existing = await this.scheduleRepo.findOne({
      where: {
        employeeId,
        locationId: ctx.locationId,
        dayOfWeek: day.dayOfWeek,
      },
    });

    if (existing) {
      existing.isWorking = day.isWorking;
      existing.startTime = day.isWorking ? (day.startTime ?? null) : null;
      existing.endTime = day.isWorking ? (day.endTime ?? null) : null;
      if (slotDuration !== undefined) existing.slotDuration = slotDuration;
      return this.scheduleRepo.save(existing);
    }

    const newRecord = this.scheduleRepo.create({
      employeeId,
      locationId: ctx.locationId,
      organizationId: ctx.organizationId,
      dayOfWeek: day.dayOfWeek,
      isWorking: day.isWorking,
      startTime: day.isWorking ? (day.startTime ?? null) : null,
      endTime: day.isWorking ? (day.endTime ?? null) : null,
      slotDuration: slotDuration ?? 30,
      createdBy: userId,
    });

    return this.scheduleRepo.save(newRecord);
  }
}
