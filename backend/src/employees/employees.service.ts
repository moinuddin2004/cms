import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Employee } from './entities/employee.entity';
import { EmployeeOrgLocationAssignment } from './entities/employee-org-location-assignment.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateSalaryDto } from './dto/update-salary.dto';
import { EmployeeFilterDto } from './dto/employee-filter.dto';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { EmploymentType } from './enums/employee.enums';
import { User } from 'src/user/entities/user.entity';
import { ProviderEnum } from 'src/auth/enum/ProviderEnum';
import { ClockService } from 'src/common/clock/clock.service';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { EmploymentRole } from './entities/employment-role.entity';
import { billingError } from 'src/billing/common/billing-errors';
import { fromPaisa } from 'src/billing/common/money';
import {
  COMMISSIONS_FEATURE,
  CompensationPlanType,
} from 'src/billing/commissions/commission.enums';
import { rupeesToPaisa } from 'src/billing/commissions/commission-math';
import {
  CompensationPlanVersions,
  PlanVersionInput,
} from 'src/billing/commissions/compensation-plan-versions';
import { CompensationPlan } from 'src/billing/commissions/entities/compensation-plan.entity';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(EmployeeOrgLocationAssignment)
    private readonly assignmentRepo: Repository<EmployeeOrgLocationAssignment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EmploymentRole)
    private readonly roleRepo: Repository<EmploymentRole>,
    private readonly clock: ClockService,
    private readonly flags: FeatureFlagsService,
  ) {}

  /** Clinic "today" at the location (ClockService, never server time). */
  private async clinicToday(locationId: string): Promise<string> {
    return this.clock.today(await this.clock.timezoneFor(locationId));
  }

  private toPaisaOrFail(rupees: number | string): number {
    const paisa = rupeesToPaisa(rupees);
    if (paisa === null) {
      throw new BadRequestException(
        'Salary must be a positive amount with at most 2 decimals',
      );
    }
    return paisa;
  }

  /**
   * First compensation version of a new assignment: the optional
   * compensation step, else a salaried plan from `grossSalary` (0 = no
   * salary yet, same as the old null). Validated before anything is saved.
   */
  private async initialPlan(
    ctx: TenantContext,
    dto: CreateEmployeeDto,
    role: EmploymentRole | null,
    joining: string,
  ): Promise<PlanVersionInput> {
    const c = dto.compensation;
    const input: PlanVersionInput = c
      ? {
          type: c.type,
          baseSalaryPaisa: c.baseSalaryPaisa ?? null,
          defaultRateBps: c.defaultRateBps ?? null,
          commissionBasis: c.commissionBasis,
          effectiveFrom: c.effectiveFrom ?? joining,
          rules: c.rules,
        }
      : {
          type: CompensationPlanType.SALARY,
          baseSalaryPaisa:
            dto.grossSalary == null ? 0 : this.toPaisaOrFail(dto.grossSalary),
          effectiveFrom: joining,
        };
    CompensationPlanVersions.validateFields(input);
    if (input.type !== CompensationPlanType.SALARY) {
      const enabled = await this.flags.isFeatureEnabled(
        ctx.organizationId,
        COMMISSIONS_FEATURE,
      );
      if (!enabled) {
        throw billingError(
          'COMMISSIONS_DISABLED',
          'Doctor commissions are not enabled',
        );
      }
      if (!CompensationPlanVersions.canConsult({ employmentRole: role })) {
        throw billingError(
          'COMMISSION_ROLE_CANNOT_CONSULT',
          'Commission is only for staff whose role can consult patients',
        );
      }
    }
    return input;
  }

  /**
   * A salary change is a new compensation version from today (the
   * deprecated `gross_salary` column is no longer written). Commission
   * settings of the current version carry over.
   */
  private async addSalaryVersion(
    assignment: EmployeeOrgLocationAssignment,
    rupees: number | string,
    userId: string | null,
  ): Promise<number> {
    const paisa = this.toPaisaOrFail(rupees);
    const today = await this.clinicToday(assignment.locationId);
    await this.assignmentRepo.manager.transaction(async (m) => {
      const current = await CompensationPlanVersions.activeOn(
        m,
        assignment.id,
        today,
      );
      if (current?.baseSalaryPaisa === paisa) return;
      const earns = !!current && current.type !== CompensationPlanType.SALARY;
      await CompensationPlanVersions.add(
        m,
        assignment,
        {
          type: earns
            ? CompensationPlanType.SALARY_PLUS_COMMISSION
            : CompensationPlanType.SALARY,
          baseSalaryPaisa: paisa,
          defaultRateBps: earns ? current.defaultRateBps : null,
          commissionBasis: current?.commissionBasis,
          effectiveFrom: today,
          rules: earns
            ? current.rules.map((r) => ({
                serviceId: r.serviceId ?? undefined,
                serviceCategory: r.serviceCategory ?? undefined,
                rateBps: r.rateBps ?? undefined,
                fixedAmountPaisa: r.fixedAmountPaisa ?? undefined,
              }))
            : [],
        },
        userId,
      );
    });
    return paisa;
  }

  /** Current plans for display (salary / type), keyed by assignment id. */
  private async currentPlans(
    assignments: EmployeeOrgLocationAssignment[],
    locationId: string,
  ): Promise<Map<string, CompensationPlan>> {
    return CompensationPlanVersions.activeForMany(
      this.assignmentRepo.manager,
      assignments.map((a) => a.id),
      await this.clinicToday(locationId),
    );
  }

  /** Salary in rupees from the current plan, else the deprecated column. */
  private salaryOf(
    a: EmployeeOrgLocationAssignment,
    plan: CompensationPlan | undefined,
  ): number | null {
    if (plan) {
      return plan.baseSalaryPaisa ? fromPaisa(plan.baseSalaryPaisa) : null;
    }
    return a.grossSalary ? Number(a.grossSalary) : null;
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  private async generateEmployeeCode(
    organizationId: string,
  ): Promise<string> {
    const count = await this.assignmentRepo.count({
      where: { organizationId },
    });
    return `EMP-${String(count + 1).padStart(3, '0')}`;
  }

  private async createPortalUser(email: string, password: string, name: string): Promise<User> {
    const existing = await this.userRepo.findOneBy({ email });
    if (existing) {
      throw new ConflictException(`A user with email ${email} already exists`);
    }
    const hashed = await bcrypt.hash(password, 12);
    const user = this.userRepo.create({
      email,
      name,
      password: hashed,
      provider: ProviderEnum.LOCAL,
      globalRole: null,
    });
    return this.userRepo.save(user);
  }

  private async getAssignmentOrFail(
    employeeId: string,
    organizationId: string,
    locationId: string,
  ): Promise<EmployeeOrgLocationAssignment> {
    const assignment = await this.assignmentRepo.findOne({
      where: { employeeId, organizationId, locationId },
      relations: ['employee', 'employmentRole', 'location'],
    });
    if (!assignment) {
      throw new NotFoundException('Employee not found at this location');
    }
    return assignment;
  }

  // ═══════════════════════════════════════════════════════════
  // CREATE
  // ═══════════════════════════════════════════════════════════

  async create(
    ctx: TenantContext,
    dto: CreateEmployeeDto,
    userId: string,
  ): Promise<any> {
    const { organizationId, locationId } = ctx;

    // 1. Check phone unique globally
    const existing = await this.employeeRepo.findOne({
      where: { phone: dto.phone },
    });
    if (existing) {
      throw new ConflictException(
        'An employee with this phone number already exists',
      );
    }

    // 2. Compensation is validated before anything is saved.
    const role = dto.employmentRoleId
      ? await this.roleRepo.findOne({
          where: { id: dto.employmentRoleId, organizationId },
        })
      : null;
    const joining =
      dto.joiningDate?.slice(0, 10) ?? (await this.clinicToday(locationId));
    const planInput = await this.initialPlan(ctx, dto, role, joining);

    // 2b. Create Employee with personal info only
    const employee = this.employeeRepo.create({
      fullName: dto.fullName,
      phone: dto.phone,
      cnic: dto.cnic || null,
      gender: dto.gender || null,
      dob: dto.dob ? new Date(dto.dob) : null,
      profilePictureUrl: dto.profilePictureUrl || null,
    });
    const savedEmployee = await this.employeeRepo.save(employee);

    // 3. Auto-generate employeeCode for this org
    const employeeCode = await this.generateEmployeeCode(organizationId);

    // 4. If portal access enabled and no existing userId, create a portal user
    let resolvedUserId = dto.userId || null;
    if (dto.hasPortalAccess && !resolvedUserId) {
      if (!dto.portalEmail || !dto.portalPassword) {
        throw new BadRequestException(
          'portalEmail and portalPassword are required when hasPortalAccess is true',
        );
      }
      const portalUser = await this.createPortalUser(
        dto.portalEmail,
        dto.portalPassword,
        dto.fullName,
      );
      resolvedUserId = portalUser.uuid;
    }

    // 5. Create assignment at current org+location
    const assignment = this.assignmentRepo.create({
      employeeId: savedEmployee.id,
      organizationId,
      locationId,
      designation: dto.designation,
      employmentRoleId: dto.employmentRoleId || null,
      employmentType:
        (dto.employmentType as EmploymentType) || EmploymentType.FULL_TIME,
      employeeCode,
      joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : new Date(),
      grossSalary: null, // deprecated: salary lives in compensation_plans
      hasPortalAccess: dto.hasPortalAccess ?? false,
      userId: resolvedUserId,
      isPrimary: dto.isPrimary ?? true,
      createdBy: userId,
    });
    await this.assignmentRepo.manager.transaction(async (m) => {
      const saved = await m.save(assignment);
      await CompensationPlanVersions.add(
        m,
        { ...saved, employmentRole: role },
        planInput,
        userId,
      );
    });

    // 6. Return employee with assignment
    return this.findOne(savedEmployee.id, ctx);
  }

  // ═══════════════════════════════════════════════════════════
  // FIND ALL (by location)
  // ═══════════════════════════════════════════════════════════

  async findAll(
    ctx: TenantContext,
    filters: EmployeeFilterDto,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { organizationId, locationId } = ctx;
    const { search, role, employmentType, isActive, page = 1, limit = 20 } = filters;

    const qb = this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.employee', 'e')
      .leftJoinAndSelect('a.employmentRole', 'role')
      .leftJoinAndSelect('a.location', 'loc')
      .where('a.organization_id = :organizationId', { organizationId })
      .andWhere('a.location_id = :locationId', { locationId });

    // Search on employee name, phone, or code
    if (search?.trim()) {
      qb.andWhere(
        '(e.fullName ILIKE :search OR e.phone ILIKE :search OR a.employeeCode ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    // Role filter
    if (role?.trim()) {
      qb.andWhere('role.slug = :role', { role });
    }

    // Employment type filter
    if (employmentType?.trim()) {
      qb.andWhere('a.employmentType = :employmentType', { employmentType });
    }

    // isActive filter
    if (isActive !== undefined) {
      qb.andWhere('a.isActive = :isActive', { isActive });
    }

    qb.orderBy('a.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [assignments, total] = await qb.getManyAndCount();
    const plans = await this.currentPlans(assignments, locationId);

    const data = assignments.map((a) => ({
      id: a.employee.id,
      fullName: a.employee.fullName,
      phone: a.employee.phone,
      cnic: a.employee.cnic,
      gender: a.employee.gender,
      dob: a.employee.dob,
      profilePictureUrl: a.employee.profilePictureUrl,
      isActive: a.isActive,
      // Assignment fields
      assignmentId: a.id,
      designation: a.designation,
      employmentType: a.employmentType,
      employeeCode: a.employeeCode,
      joiningDate: a.joiningDate,
      grossSalary: this.salaryOf(a, plans.get(a.id)),
      compensationType: plans.get(a.id)?.type ?? null,
      hasPortalAccess: a.hasPortalAccess,
      isPrimary: a.isPrimary,
      employmentRole: a.employmentRole,
      location: a.location,
      createdAt: a.createdAt,
      // Compat: keep currentSalary shape for frontend
      currentSalary: this.salaryOf(a, plans.get(a.id))
        ? { grossSalary: this.salaryOf(a, plans.get(a.id)) }
        : null,
    }));

    return { data, total, page, limit };
  }

  // ═══════════════════════════════════════════════════════════
  // FIND ONE
  // ═══════════════════════════════════════════════════════════

  async findOne(
    employeeId: string,
    ctx: TenantContext,
  ): Promise<any> {
    const { organizationId, locationId } = ctx;

    const assignment = await this.assignmentRepo.findOne({
      where: { employeeId, organizationId, locationId },
      relations: ['employee', 'employmentRole', 'location', 'user'],
    });

    if (!assignment) {
      throw new NotFoundException('Employee not found at this location');
    }

    const e = assignment.employee;
    const plan = (await this.currentPlans([assignment], locationId)).get(
      assignment.id,
    );
    const salary = this.salaryOf(assignment, plan);

    return {
      id: e.id,
      fullName: e.fullName,
      phone: e.phone,
      cnic: e.cnic,
      gender: e.gender,
      dob: e.dob,
      profilePictureUrl: e.profilePictureUrl,
      isActive: assignment.isActive,
      // Assignment fields
      assignmentId: assignment.id,
      designation: assignment.designation,
      employmentType: assignment.employmentType,
      employeeCode: assignment.employeeCode,
      joiningDate: assignment.joiningDate,
      grossSalary: salary,
      compensationType: plan?.type ?? null,
      hasPortalAccess: assignment.hasPortalAccess,
      isPrimary: assignment.isPrimary,
      userId: assignment.userId,
      organizationId: assignment.organizationId,
      primaryLocationId: assignment.locationId,
      primaryLocation: assignment.location,
      employmentRoleId: assignment.employmentRoleId,
      employmentRole: assignment.employmentRole,
      createdBy: assignment.createdBy,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      // Compat: keep currentSalary shape for frontend
      currentSalary: salary
        ? {
            grossSalary: salary,
            effectiveFrom: plan?.effectiveFrom ?? assignment.joiningDate,
          }
        : null,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════════════════════

  async update(
    employeeId: string,
    ctx: TenantContext,
    dto: UpdateEmployeeDto,
  ): Promise<any> {
    const { organizationId, locationId } = ctx;
    const assignment = await this.getAssignmentOrFail(
      employeeId,
      organizationId,
      locationId,
    );
    const employee = assignment.employee;

    // Update personal fields on employee
    if (dto.fullName !== undefined) employee.fullName = dto.fullName;
    if (dto.phone !== undefined) employee.phone = dto.phone;
    if (dto.cnic !== undefined) employee.cnic = dto.cnic || null;
    if (dto.gender !== undefined) employee.gender = dto.gender || null;
    if (dto.dob !== undefined)
      employee.dob = dto.dob ? new Date(dto.dob) : null;
    if (dto.profilePictureUrl !== undefined)
      employee.profilePictureUrl = dto.profilePictureUrl || null;

    await this.employeeRepo.save(employee);

    // Update assignment fields
    if (dto.designation !== undefined) assignment.designation = dto.designation;
    if (dto.employmentRoleId !== undefined)
      assignment.employmentRoleId = dto.employmentRoleId || null;
    if (dto.employmentType !== undefined)
      assignment.employmentType = dto.employmentType as EmploymentType;
    if (dto.joiningDate !== undefined)
      assignment.joiningDate = new Date(dto.joiningDate);
    if (dto.isPrimary !== undefined) assignment.isPrimary = dto.isPrimary;

    // Handle portal access: create user if enabling and no user linked yet
    if (dto.hasPortalAccess !== undefined) {
      if (dto.hasPortalAccess && !assignment.userId) {
        if (!dto.portalEmail || !dto.portalPassword) {
          throw new BadRequestException(
            'portalEmail and portalPassword are required when enabling portal access',
          );
        }
        const portalUser = await this.createPortalUser(
          dto.portalEmail,
          dto.portalPassword,
          employee.fullName,
        );
        assignment.userId = portalUser.uuid;
      }
      assignment.hasPortalAccess = dto.hasPortalAccess;
    }
    if (dto.userId !== undefined) assignment.userId = dto.userId || null;

    await this.assignmentRepo.save(assignment);
    if (dto.grossSalary != null) {
      await this.addSalaryVersion(assignment, dto.grossSalary, null);
    }

    return this.findOne(employeeId, ctx);
  }

  // ═══════════════════════════════════════════════════════════
  // DEACTIVATE
  // ═══════════════════════════════════════════════════════════

  async setActive(
    employeeId: string,
    ctx: TenantContext,
    isActive: boolean,
  ): Promise<{ employeeId: string; isActive: boolean }> {
    const assignment = await this.getAssignmentOrFail(
      employeeId,
      ctx.organizationId,
      ctx.locationId,
    );
    assignment.isActive = isActive;
    await this.assignmentRepo.save(assignment);
    return { employeeId, isActive };
  }

  /**
   * Permanently deletes the employee. Payroll, leaves, schedules and
   * availability overrides go with them (ON DELETE CASCADE); appointments,
   * invoices etc. keep their rows with the doctor/creator set to NULL.
   * Refused when the employee also works at another location, or is still
   * referenced by inventory records (purchase orders, stock movements,
   * patient consumptions) — deactivate them instead.
   */
  async remove(employeeId: string, ctx: TenantContext): Promise<void> {
    await this.getAssignmentOrFail(
      employeeId,
      ctx.organizationId,
      ctx.locationId,
    );

    const otherAssignments = await this.assignmentRepo.count({
      where: { employeeId, locationId: Not(ctx.locationId) },
    });
    if (otherAssignments > 0) {
      throw new ConflictException(
        'This employee is also assigned to other locations and cannot be deleted. Deactivate them here instead.',
      );
    }

    try {
      await this.employeeRepo.delete({ id: employeeId });
    } catch (err) {
      // 23503 = foreign_key_violation
      if ((err as { code?: string }).code === '23503') {
        throw new ConflictException(
          'This employee has linked inventory records and cannot be deleted. Deactivate them instead.',
        );
      }
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PORTAL ACCESS TOGGLE
  // ═══════════════════════════════════════════════════════════

  async togglePortalAccess(
    employeeId: string,
    ctx: TenantContext,
    hasPortalAccess: boolean,
  ): Promise<any> {
    const assignment = await this.getAssignmentOrFail(
      employeeId,
      ctx.organizationId,
      ctx.locationId,
    );
    assignment.hasPortalAccess = hasPortalAccess;
    const saved = await this.assignmentRepo.save(assignment);
    return {
      employeeId,
      assignmentId: saved.id,
      hasPortalAccess: saved.hasPortalAccess,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // UPDATE SALARY
  // ═══════════════════════════════════════════════════════════

  async updateSalary(
    employeeId: string,
    ctx: TenantContext,
    dto: UpdateSalaryDto,
  ): Promise<any> {
    const assignment = await this.getAssignmentOrFail(
      employeeId,
      ctx.organizationId,
      ctx.locationId,
    );
    const paisa = await this.addSalaryVersion(assignment, dto.grossSalary, null);
    return {
      assignmentId: assignment.id,
      grossSalary: fromPaisa(paisa),
    };
  }

  // ═══════════════════════════════════════════════════════════
  // GET ASSIGNMENTS BY EMPLOYEE (all orgs/locations)
  // ═══════════════════════════════════════════════════════════

  async getAssignmentsByEmployee(employeeId: string): Promise<any> {
    const assignments = await this.assignmentRepo.find({
      where: { employeeId },
      relations: ['organization', 'location', 'employmentRole'],
      order: { createdAt: 'DESC' },
    });
    return assignments;
  }

  // ═══════════════════════════════════════════════════════════
  // USED BY PAYROLL SERVICE
  // ═══════════════════════════════════════════════════════════

  async getActiveAssignmentsByLocation(
    locationId: string,
    organizationId: string,
  ): Promise<EmployeeOrgLocationAssignment[]> {
    return this.assignmentRepo.find({
      where: {
        locationId,
        organizationId,
        isActive: true,
      },
      relations: ['employee'],
    });
  }
}
