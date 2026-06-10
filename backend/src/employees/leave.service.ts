import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EmployeeLeave } from './entities/employee-leave.entity';
import { EmployeeOrgLocationAssignment } from './entities/employee-org-location-assignment.entity';
import { CreateLeaveDto } from './dto/create-leave.dto';
import {
  UpdateLeaveDto,
  ReviewLeaveDto,
  LeaveFilterDto,
} from './dto/update-leave.dto';
import { LeaveStatus, LeaveType } from './enums/employee.enums';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

export interface LeaveBalance {
  year: number;
  totalApprovedDays: number;
  pendingRequests: number;
  byType: Record<string, number>;
}

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(EmployeeLeave)
    private readonly leaveRepo: Repository<EmployeeLeave>,
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

  private calcTotalDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid start or end date');
    }
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('End date must be on or after start date');
    }
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
  }

  private async checkOverlap(
    employeeId: string,
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.leaveRepo
      .createQueryBuilder('l')
      .where('l.employee_id = :employeeId', { employeeId })
      .andWhere('l.status IN (:...statuses)', {
        statuses: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
      })
      .andWhere('l.start_date <= :endDate', { endDate })
      .andWhere('l.end_date >= :startDate', { startDate });

    if (excludeId) {
      qb.andWhere('l.id != :excludeId', { excludeId });
    }

    const overlap = await qb.getOne();
    if (overlap) {
      throw new BadRequestException(
        'Employee already has a pending or approved leave overlapping these dates',
      );
    }
  }

  private async findOneScoped(
    id: string,
    ctx: TenantContext,
  ): Promise<EmployeeLeave> {
    const leave = await this.leaveRepo.findOne({
      where: { id, organizationId: ctx.organizationId },
      relations: ['employee'],
    });
    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }
    return leave;
  }

  // ═══════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════

  async create(
    dto: CreateLeaveDto,
    ctx: TenantContext,
    userId?: string,
  ): Promise<EmployeeLeave> {
    await this.verifyAssignment(dto.employeeId, ctx);

    const totalDays = this.calcTotalDays(dto.startDate, dto.endDate);
    await this.checkOverlap(dto.employeeId, dto.startDate, dto.endDate);

    const leave = this.leaveRepo.create({
      employeeId: dto.employeeId,
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
      leaveType: dto.leaveType,
      startDate: dto.startDate,
      endDate: dto.endDate,
      totalDays,
      status: LeaveStatus.PENDING,
      reason: dto.reason ?? null,
      createdBy: userId ?? null,
    });

    return this.leaveRepo.save(leave);
  }

  async findAll(
    filters: LeaveFilterDto,
    ctx: TenantContext,
  ): Promise<EmployeeLeave[]> {
    const where: Record<string, any> = {
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
    };
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status;
    if (filters.leaveType) where.leaveType = filters.leaveType;

    return this.leaveRepo.find({
      where,
      relations: ['employee'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, ctx: TenantContext): Promise<EmployeeLeave> {
    return this.findOneScoped(id, ctx);
  }

  async update(
    id: string,
    dto: UpdateLeaveDto,
    ctx: TenantContext,
  ): Promise<EmployeeLeave> {
    const leave = await this.findOneScoped(id, ctx);

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Only pending leave requests can be edited',
      );
    }

    const startDate = dto.startDate ?? leave.startDate;
    const endDate = dto.endDate ?? leave.endDate;
    const totalDays = this.calcTotalDays(startDate, endDate);
    await this.checkOverlap(leave.employeeId, startDate, endDate, leave.id);

    leave.leaveType = dto.leaveType ?? leave.leaveType;
    leave.startDate = startDate;
    leave.endDate = endDate;
    leave.totalDays = totalDays;
    if (dto.reason !== undefined) leave.reason = dto.reason;

    return this.leaveRepo.save(leave);
  }

  // ═══════════════════════════════════════════════════════════
  // STATUS TRANSITIONS
  // ═══════════════════════════════════════════════════════════

  async approve(
    id: string,
    dto: ReviewLeaveDto,
    ctx: TenantContext,
    userId?: string,
  ): Promise<EmployeeLeave> {
    return this.review(id, LeaveStatus.APPROVED, dto, ctx, userId);
  }

  async reject(
    id: string,
    dto: ReviewLeaveDto,
    ctx: TenantContext,
    userId?: string,
  ): Promise<EmployeeLeave> {
    return this.review(id, LeaveStatus.REJECTED, dto, ctx, userId);
  }

  async cancel(id: string, ctx: TenantContext): Promise<EmployeeLeave> {
    const leave = await this.findOneScoped(id, ctx);

    if (
      leave.status !== LeaveStatus.PENDING &&
      leave.status !== LeaveStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Only pending or approved leave requests can be cancelled',
      );
    }

    leave.status = LeaveStatus.CANCELLED;
    return this.leaveRepo.save(leave);
  }

  private async review(
    id: string,
    status: LeaveStatus.APPROVED | LeaveStatus.REJECTED,
    dto: ReviewLeaveDto,
    ctx: TenantContext,
    userId?: string,
  ): Promise<EmployeeLeave> {
    const leave = await this.findOneScoped(id, ctx);

    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        'Only pending leave requests can be reviewed',
      );
    }

    leave.status = status;
    leave.reviewNote = dto.reviewNote ?? null;
    leave.approvedBy = userId ?? null;
    leave.reviewedAt = new Date();

    return this.leaveRepo.save(leave);
  }

  // ═══════════════════════════════════════════════════════════
  // BALANCE
  // ═══════════════════════════════════════════════════════════

  async getBalance(
    employeeId: string,
    ctx: TenantContext,
  ): Promise<LeaveBalance> {
    await this.verifyAssignment(employeeId, ctx);

    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const leaves = await this.leaveRepo
      .createQueryBuilder('l')
      .where('l.employee_id = :employeeId', { employeeId })
      .andWhere('l.organization_id = :orgId', { orgId: ctx.organizationId })
      .andWhere('l.status IN (:...statuses)', {
        statuses: [LeaveStatus.APPROVED, LeaveStatus.PENDING],
      })
      .andWhere('l.start_date <= :yearEnd', { yearEnd })
      .andWhere('l.end_date >= :yearStart', { yearStart })
      .getMany();

    const byType: Record<string, number> = {};
    for (const type of Object.values(LeaveType)) {
      byType[type] = 0;
    }

    let totalApprovedDays = 0;
    let pendingRequests = 0;

    for (const leave of leaves) {
      if (leave.status === LeaveStatus.APPROVED) {
        totalApprovedDays += leave.totalDays;
        byType[leave.leaveType] = (byType[leave.leaveType] || 0) + leave.totalDays;
      } else if (leave.status === LeaveStatus.PENDING) {
        pendingRequests += 1;
      }
    }

    return { year, totalApprovedDays, pendingRequests, byType };
  }
}
