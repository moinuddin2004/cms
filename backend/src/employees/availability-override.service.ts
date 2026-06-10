import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DoctorAvailabilityOverride,
  OverrideHoursSlot,
} from './entities/doctor-availability-override.entity';
import { EmployeeOrgLocationAssignment } from './entities/employee-org-location-assignment.entity';
import {
  CreateAvailabilityOverrideDto,
  UpdateAvailabilityOverrideDto,
  OverrideFilterDto,
} from './dto/availability-override.dto';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Injectable()
export class AvailabilityOverrideService {
  constructor(
    @InjectRepository(DoctorAvailabilityOverride)
    private readonly overrideRepo: Repository<DoctorAvailabilityOverride>,
    @InjectRepository(EmployeeOrgLocationAssignment)
    private readonly assignmentRepo: Repository<EmployeeOrgLocationAssignment>,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // HELPERS
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

  private validateHours(slots?: OverrideHoursSlot[] | null): void {
    if (!slots || slots.length === 0) return;
    const sorted = [...slots].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
    for (const slot of sorted) {
      if (slot.endTime <= slot.startTime) {
        throw new BadRequestException(
          `Slot ${slot.startTime}–${slot.endTime}: end time must be after start time`,
        );
      }
    }
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startTime < sorted[i - 1].endTime) {
        throw new BadRequestException('Override hour slots must not overlap');
      }
    }
  }

  private async findOneScoped(
    id: string,
    employeeId: string,
    ctx: TenantContext,
  ): Promise<DoctorAvailabilityOverride> {
    const override = await this.overrideRepo.findOne({
      where: {
        id,
        employeeId,
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
      },
    });
    if (!override) {
      throw new NotFoundException('Availability override not found');
    }
    return override;
  }

  // ═══════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════

  async create(
    employeeId: string,
    dto: CreateAvailabilityOverrideDto,
    ctx: TenantContext,
    userId?: string,
  ): Promise<DoctorAvailabilityOverride> {
    await this.verifyAssignment(employeeId, ctx);
    this.validateHours(dto.overrideHours);

    const existing = await this.overrideRepo.findOne({
      where: {
        employeeId,
        locationId: ctx.locationId,
        date: dto.date,
      },
    });
    if (existing) {
      throw new ConflictException(
        'An override for this employee on this date already exists',
      );
    }

    const override = this.overrideRepo.create({
      employeeId,
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
      date: dto.date,
      isAvailable: dto.isAvailable,
      reason: dto.reason ?? null,
      overrideHours: dto.isAvailable ? (dto.overrideHours ?? null) : null,
      createdBy: userId ?? null,
    });

    return this.overrideRepo.save(override);
  }

  async findAll(
    employeeId: string,
    filters: OverrideFilterDto,
    ctx: TenantContext,
  ): Promise<DoctorAvailabilityOverride[]> {
    await this.verifyAssignment(employeeId, ctx);

    const qb = this.overrideRepo
      .createQueryBuilder('o')
      .where('o.employee_id = :employeeId', { employeeId })
      .andWhere('o.organization_id = :orgId', { orgId: ctx.organizationId })
      .andWhere('o.location_id = :locId', { locId: ctx.locationId })
      .orderBy('o.date', 'DESC');

    if (filters.from) {
      qb.andWhere('o.date >= :from', { from: filters.from });
    }
    if (filters.to) {
      qb.andWhere('o.date <= :to', { to: filters.to });
    }

    return qb.getMany();
  }

  async update(
    id: string,
    employeeId: string,
    dto: UpdateAvailabilityOverrideDto,
    ctx: TenantContext,
  ): Promise<DoctorAvailabilityOverride> {
    const override = await this.findOneScoped(id, employeeId, ctx);
    this.validateHours(dto.overrideHours);

    if (dto.date && dto.date !== override.date) {
      const duplicate = await this.overrideRepo.findOne({
        where: {
          employeeId,
          locationId: ctx.locationId,
          date: dto.date,
        },
      });
      if (duplicate) {
        throw new ConflictException(
          'An override for this employee on this date already exists',
        );
      }
      override.date = dto.date;
    }

    if (dto.isAvailable !== undefined) override.isAvailable = dto.isAvailable;
    if (dto.reason !== undefined) override.reason = dto.reason;
    if (dto.overrideHours !== undefined) {
      override.overrideHours = dto.overrideHours;
    }
    if (!override.isAvailable) {
      override.overrideHours = null;
    }

    return this.overrideRepo.save(override);
  }

  async remove(
    id: string,
    employeeId: string,
    ctx: TenantContext,
  ): Promise<{ id: string }> {
    const override = await this.findOneScoped(id, employeeId, ctx);
    await this.overrideRepo.remove(override);
    return { id };
  }
}
