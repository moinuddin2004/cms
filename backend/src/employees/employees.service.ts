import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeeSalary } from './entities/employee-salary.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { SetSalaryDto } from './dto/set-salary.dto';
import { EmployeeFilterDto } from './dto/employee-filter.dto';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(EmployeeSalary)
    private readonly salaryRepo: Repository<EmployeeSalary>,
    private readonly dataSource: DataSource,
  ) { }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  private async generateEmployeeCode(organizationId: string): Promise<string> {
    const count = await this.employeeRepo.count({
      where: { organizationId },
    });
    return `EMP-${String(count + 1).padStart(3, '0')}`;
  }

  private async getEmployeeOrFail(
    id: string,
    organizationId: string,
  ): Promise<Employee> {
    const employee = await this.employeeRepo.findOne({
      where: { id, organizationId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return employee;
  }

  // ═══════════════════════════════════════════════════════════
  // EMPLOYEE CRUD
  // ═══════════════════════════════════════════════════════════

  async create(
    ctx: TenantContext,
    dto: CreateEmployeeDto,
    userId: string,
  ): Promise<Employee> {
    const { organizationId } = ctx;

    const employeeCode = await this.generateEmployeeCode(organizationId);

    const employee = this.employeeRepo.create({
      ...dto,
      organizationId,
      employeeCode,
      dob: dto.dob ? new Date(dto.dob) : null,
      joiningDate: new Date(dto.joiningDate),
      hasPortalAccess: dto.hasPortalAccess ?? false,
      userId: dto.userId || null,
      profilePictureUrl: dto.profilePictureUrl || null,
      cnic: dto.cnic || null,
      gender: dto.gender || null,
      createdBy: userId,
    });

    const saved = await this.employeeRepo.save(employee);

    return this.findOne(saved.id, organizationId);
  }

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

    const qb = this.employeeRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.employmentRole', 'role')
      .leftJoinAndSelect('e.primaryLocation', 'loc')
      .leftJoin(
        'employee_salaries',
        'sal',
        'sal.employee_id = e.id AND sal.is_current = true',
      )
      .addSelect([
        'sal.id',
        'sal.gross_salary',
        'sal.effective_from',
      ])
      .where('e.organization_id = :organizationId', { organizationId });

    // Filter by primary location from header
    if (locationId) {
      qb.andWhere('e.primary_location_id = :locationId', { locationId });
    }

    // Search
    if (search?.trim()) {
      qb.andWhere(
        '(e.full_name ILIKE :search OR e.phone ILIKE :search OR e.employee_code ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    // Role filter
    if (role?.trim()) {
      qb.andWhere('role.slug = :role', { role });
    }

    // isActive filter
    if (isActive !== undefined) {
      qb.andWhere('e.is_active = :isActive', { isActive });
    }

    qb.orderBy('e.created_at', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [employees, total] = await qb.getManyAndCount();

    // Load current salary for each employee
    const employeeIds = employees.map((e) => e.id);
    let salaryMap: Record<string, EmployeeSalary> = {};

    if (employeeIds.length > 0) {
      const salaries = await this.salaryRepo
        .createQueryBuilder('s')
        .where('s.employee_id IN (:...ids)', { ids: employeeIds })
        .andWhere('s.is_current = true')
        .getMany();

      salaryMap = salaries.reduce(
        (acc, s) => {
          acc[s.employeeId] = s;
          return acc;
        },
        {} as Record<string, EmployeeSalary>,
      );
    }

    const data = employees.map((e) => ({
      ...e,
      currentSalary: salaryMap[e.id] || null,
    }));

    return { data, total, page, limit };
  }

  async findOne(id: string, organizationId: string): Promise<any> {
    const employee = await this.employeeRepo.findOne({
      where: { id, organizationId },
      relations: ['employmentRole', 'primaryLocation', 'user'],
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Load current salary
    const currentSalary = await this.salaryRepo.findOne({
      where: { employeeId: id, isCurrent: true },
    });

    return {
      ...employee,
      currentSalary: currentSalary || null,
    };
  }

  async update(
    id: string,
    ctx: TenantContext,
    dto: UpdateEmployeeDto,
  ): Promise<any> {
    const employee = await this.getEmployeeOrFail(id, ctx.organizationId);

    const updateData: Partial<Employee> = { ...dto } as any;
    if (dto.dob !== undefined) {
      updateData.dob = dto.dob ? new Date(dto.dob) : null;
    }
    if (dto.joiningDate !== undefined) {
      updateData.joiningDate = new Date(dto.joiningDate);
    }

    Object.assign(employee, updateData);
    await this.employeeRepo.save(employee);

    return this.findOne(id, ctx.organizationId);
  }

  async deactivate(id: string, organizationId: string): Promise<Employee> {
    const employee = await this.getEmployeeOrFail(id, organizationId);
    employee.isActive = false;
    return this.employeeRepo.save(employee);
  }

  // ═══════════════════════════════════════════════════════════
  // SALARY MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  async setSalary(
    employeeId: string,
    ctx: TenantContext,
    dto: SetSalaryDto,
    userId: string,
  ): Promise<EmployeeSalary> {
    await this.getEmployeeOrFail(employeeId, ctx.organizationId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Find current active salary
      const currentSalary = await queryRunner.manager.findOne(EmployeeSalary, {
        where: { employeeId, isCurrent: true },
      });

      // 2. If exists → deactivate and set effectiveUntil
      if (currentSalary) {
        const effectiveUntil = new Date(dto.effectiveFrom);
        effectiveUntil.setDate(effectiveUntil.getDate() - 1);

        currentSalary.isCurrent = false;
        currentSalary.effectiveUntil = effectiveUntil;
        await queryRunner.manager.save(currentSalary);
      }

      // 3. Create new salary record
      const newSalary = queryRunner.manager.create(EmployeeSalary, {
        employeeId,
        organizationId: ctx.organizationId,
        grossSalary: dto.grossSalary,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveUntil: null,
        isCurrent: true,
        notes: dto.notes || null,
        createdBy: userId,
      });

      const saved = await queryRunner.manager.save(newSalary);
      await queryRunner.commitTransaction();

      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getSalaryHistory(
    employeeId: string,
    organizationId: string,
  ): Promise<EmployeeSalary[]> {
    await this.getEmployeeOrFail(employeeId, organizationId);

    return this.salaryRepo.find({
      where: { employeeId },
      order: { effectiveFrom: 'DESC' },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // USED BY PAYROLL SERVICE
  // ═══════════════════════════════════════════════════════════

  async getActiveEmployeesByLocation(
    locationId: string,
    organizationId: string,
  ): Promise<Employee[]> {
    return this.employeeRepo.find({
      where: {
        primaryLocationId: locationId,
        organizationId,
        isActive: true,
      },
    });
  }

  async getCurrentSalary(
    employeeId: string,
  ): Promise<EmployeeSalary | null> {
    return this.salaryRepo.findOne({
      where: { employeeId, isCurrent: true },
    });
  }
}
