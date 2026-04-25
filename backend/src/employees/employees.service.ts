import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeeOrgLocationAssignment } from './entities/employee-org-location-assignment.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateSalaryDto } from './dto/update-salary.dto';
import { EmployeeFilterDto } from './dto/employee-filter.dto';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { EmploymentType } from './enums/employee.enums';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(EmployeeOrgLocationAssignment)
    private readonly assignmentRepo: Repository<EmployeeOrgLocationAssignment>,
  ) {}

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

    // 2. Create Employee with personal info only
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

    // 4. Create assignment at current org+location
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
      grossSalary: dto.grossSalary ?? null,
      hasPortalAccess: dto.hasPortalAccess ?? false,
      userId: dto.userId || null,
      isPrimary: dto.isPrimary ?? true,
      createdBy: userId,
    });
    await this.assignmentRepo.save(assignment);

    // 5. Return employee with assignment
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
    const { search, role, isActive, page = 1, limit = 20 } = filters;

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

    // isActive filter
    if (isActive !== undefined) {
      qb.andWhere('a.isActive = :isActive', { isActive });
    }

    qb.orderBy('a.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [assignments, total] = await qb.getManyAndCount();

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
      grossSalary: a.grossSalary,
      hasPortalAccess: a.hasPortalAccess,
      isPrimary: a.isPrimary,
      employmentRole: a.employmentRole,
      location: a.location,
      createdAt: a.createdAt,
      // Compat: keep currentSalary shape for frontend
      currentSalary: a.grossSalary
        ? { grossSalary: Number(a.grossSalary) }
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
      grossSalary: assignment.grossSalary
        ? Number(assignment.grossSalary)
        : null,
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
      currentSalary: assignment.grossSalary
        ? {
            grossSalary: Number(assignment.grossSalary),
            effectiveFrom: assignment.joiningDate,
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
    if (dto.grossSalary !== undefined) assignment.grossSalary = dto.grossSalary;
    if (dto.hasPortalAccess !== undefined)
      assignment.hasPortalAccess = dto.hasPortalAccess;
    if (dto.userId !== undefined) assignment.userId = dto.userId || null;
    if (dto.isPrimary !== undefined) assignment.isPrimary = dto.isPrimary;

    await this.assignmentRepo.save(assignment);

    return this.findOne(employeeId, ctx);
  }

  // ═══════════════════════════════════════════════════════════
  // DEACTIVATE
  // ═══════════════════════════════════════════════════════════

  async deactivate(
    employeeId: string,
    ctx: TenantContext,
  ): Promise<any> {
    const assignment = await this.getAssignmentOrFail(
      employeeId,
      ctx.organizationId,
      ctx.locationId,
    );
    assignment.isActive = false;
    await this.assignmentRepo.save(assignment);
    return { message: 'Employee deactivated at this location' };
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
    assignment.grossSalary = dto.grossSalary;
    const saved = await this.assignmentRepo.save(assignment);
    return {
      assignmentId: saved.id,
      grossSalary: Number(saved.grossSalary),
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
