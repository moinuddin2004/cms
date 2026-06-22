import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PayrollRecord } from './entities/payroll-record.entity';
import { Location } from 'src/locations/entities/location.entity';
import { EmployeesService } from 'src/employees/employees.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { PayrollStatus } from './enums/payroll.enums';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
];

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    @InjectRepository(PayrollRecord)
    private readonly payrollRepo: Repository<PayrollRecord>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    private readonly employeesService: EmployeesService,
    private readonly dataSource: DataSource,
  ) {}

  private periodLabel(month: number, year: number): string {
    return `${MONTH_NAMES[month - 1]} ${year}`;
  }

  // ═══════════════════════════════════════════════════════════
  // GENERATE PAYROLL
  // ═══════════════════════════════════════════════════════════

  async generate(
    dto: GeneratePayrollDto,
    ctx: TenantContext,
    userId: string,
  ): Promise<{
    generated: number;
    skipped: number;
    noSalary: string[];
    records: PayrollRecord[];
  }> {
    const { month, year } = dto;

    // Validate: month/year not in future
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (year > currentYear || (year === currentYear && month > currentMonth)) {
      throw new BadRequestException(
        'Cannot generate payroll for future months',
      );
    }

    return this.generateForLocation(
      ctx.organizationId,
      ctx.locationId,
      month,
      year,
      userId,
    );
  }

  /**
   * Core generation for a single location: one PENDING record per active
   * employee that has a salary and doesn't already have a record for the
   * period. Reused by the manual endpoint and the month-end scheduler.
   */
  private async generateForLocation(
    organizationId: string,
    locationId: string,
    month: number,
    year: number,
    userId: string | null,
  ): Promise<{
    generated: number;
    skipped: number;
    noSalary: string[];
    records: PayrollRecord[];
  }> {
    const assignments =
      await this.employeesService.getActiveAssignmentsByLocation(
        locationId,
        organizationId,
      );

    const periodLabel = this.periodLabel(month, year);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let generated = 0;
      let skipped = 0;
      const noSalary: string[] = [];
      const records: PayrollRecord[] = [];

      for (const assignment of assignments) {
        // Payroll is UNIQUE per employee per month/year (across locations).
        const existing = await queryRunner.manager.findOne(PayrollRecord, {
          where: { employeeId: assignment.employeeId, month, year },
        });

        if (existing) {
          skipped++;
          continue;
        }

        if (!assignment.grossSalary) {
          noSalary.push(assignment.employee.fullName);
          continue;
        }

        // Salary SNAPSHOT at time of generation.
        const record = queryRunner.manager.create(PayrollRecord, {
          employeeId: assignment.employeeId,
          organizationId,
          locationId,
          month,
          year,
          periodLabel,
          salaryAmount: assignment.grossSalary,
          status: PayrollStatus.PENDING,
          createdBy: userId,
        });

        const saved = await queryRunner.manager.save(record);
        records.push(saved);
        generated++;
      }

      await queryRunner.commitTransaction();

      return { generated, skipped, noSalary, records };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MONTH-END SCHEDULER
  // ═══════════════════════════════════════════════════════════

  /**
   * Runs at 00:05 on the 1st of every month and generates payroll for the
   * month that just ended, for every active location across all organizations.
   * Idempotent: locations already generated for the period are skipped
   * (unique constraint per employee/month), so a re-run or a manual run the
   * same period is safe. System-generated records have a null createdBy.
   */
  @Cron('0 5 1 * *', { name: 'month-end-payroll' })
  async runMonthEndPayroll(): Promise<void> {
    const now = new Date();
    let month = now.getMonth() + 1 - 1; // previous month (1-12)
    let year = now.getFullYear();
    if (month === 0) {
      month = 12;
      year -= 1;
    }

    const locations = await this.locationRepo.find({
      where: { isActive: true },
    });

    this.logger.log(
      `Month-end payroll: generating ${this.periodLabel(month, year)} for ${locations.length} location(s)`,
    );

    let totalGenerated = 0;
    let totalSkipped = 0;
    for (const loc of locations) {
      try {
        const res = await this.generateForLocation(
          loc.organizationId,
          loc.id,
          month,
          year,
          null,
        );
        totalGenerated += res.generated;
        totalSkipped += res.skipped;
      } catch (err) {
        // One bad location must not abort the rest.
        this.logger.error(
          `Month-end payroll failed for location ${loc.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Month-end payroll complete: ${totalGenerated} generated, ${totalSkipped} skipped`,
    );
  }

  // ═══════════════════════════════════════════════════════════
  // MANUAL CREATE / UPDATE / DELETE
  // ═══════════════════════════════════════════════════════════

  async createManual(
    dto: CreatePayrollDto,
    ctx: TenantContext,
    userId: string | null,
  ): Promise<PayrollRecord> {
    const existing = await this.payrollRepo.findOne({
      where: { employeeId: dto.employeeId, month: dto.month, year: dto.year },
    });
    if (existing) {
      throw new BadRequestException(
        'A payroll record already exists for this employee and period',
      );
    }

    const record = this.payrollRepo.create({
      employeeId: dto.employeeId,
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
      month: dto.month,
      year: dto.year,
      periodLabel: this.periodLabel(dto.month, dto.year),
      salaryAmount: dto.salaryAmount,
      status: dto.status ?? PayrollStatus.PENDING,
      notes: dto.notes ?? null,
      createdBy: userId,
    });

    return this.payrollRepo.save(record);
  }

  async update(
    recordId: string,
    dto: UpdatePayrollDto,
    organizationId: string,
  ): Promise<PayrollRecord> {
    const record = await this.payrollRepo.findOne({
      where: { id: recordId, organizationId },
    });
    if (!record) {
      throw new NotFoundException('Payroll record not found');
    }

    if (dto.salaryAmount !== undefined) record.salaryAmount = dto.salaryAmount;
    if (dto.status !== undefined) record.status = dto.status;
    if (dto.notes !== undefined) record.notes = dto.notes || null;
    if (dto.month !== undefined) record.month = dto.month;
    if (dto.year !== undefined) record.year = dto.year;
    if (dto.month !== undefined || dto.year !== undefined) {
      record.periodLabel = this.periodLabel(record.month, record.year);
    }

    try {
      return await this.payrollRepo.save(record);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new BadRequestException(
          'A payroll record already exists for this employee and period',
        );
      }
      throw err;
    }
  }

  async remove(
    recordId: string,
    organizationId: string,
  ): Promise<{ id: string }> {
    const record = await this.payrollRepo.findOne({
      where: { id: recordId, organizationId },
    });
    if (!record) {
      throw new NotFoundException('Payroll record not found');
    }
    await this.payrollRepo.remove(record);
    return { id: recordId };
  }

  // ═══════════════════════════════════════════════════════════
  // FIND BY LOCATION
  // ═══════════════════════════════════════════════════════════

  async findByLocation(
    ctx: TenantContext,
    month: number,
    year: number,
  ): Promise<{
    records: PayrollRecord[];
    summary: {
      totalEmployees: number;
      totalAmount: number;
      paidCount: number;
      pendingCount: number;
      onHoldCount: number;
      paidAmount: number;
      pendingAmount: number;
    };
  }> {
    const { organizationId, locationId } = ctx;

    const records = await this.payrollRepo.find({
      where: { locationId, month, year, organizationId },
      relations: ['employee'],
      order: { createdAt: 'DESC' },
    });

    const summary = records.reduce(
      (acc, r) => {
        const amount = Number(r.salaryAmount);
        acc.totalEmployees++;
        acc.totalAmount += amount;

        if (r.status === PayrollStatus.PAID) {
          acc.paidCount++;
          acc.paidAmount += amount;
        } else if (r.status === PayrollStatus.PENDING) {
          acc.pendingCount++;
          acc.pendingAmount += amount;
        } else if (r.status === PayrollStatus.ON_HOLD) {
          acc.onHoldCount++;
        }

        return acc;
      },
      {
        totalEmployees: 0,
        totalAmount: 0,
        paidCount: 0,
        pendingCount: 0,
        onHoldCount: 0,
        paidAmount: 0,
        pendingAmount: 0,
      },
    );

    return { records, summary };
  }

  // ═══════════════════════════════════════════════════════════
  // FIND BY EMPLOYEE
  // ═══════════════════════════════════════════════════════════

  async findByEmployee(
    employeeId: string,
    organizationId: string,
  ): Promise<PayrollRecord[]> {
    return this.payrollRepo.find({
      where: { employeeId, organizationId },
      order: { year: 'DESC', month: 'DESC' },
    });
  }

  // ═══════════════════════════════════════════════════════════
  // MARK PAID
  // ═══════════════════════════════════════════════════════════

  async markPaid(
    recordId: string,
    dto: MarkPaidDto,
    organizationId: string,
    userId: string,
  ): Promise<PayrollRecord> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const record = await queryRunner.manager.findOne(PayrollRecord, {
        where: { id: recordId, organizationId },
      });

      if (!record) {
        throw new NotFoundException('Payroll record not found');
      }

      if (record.status === PayrollStatus.PAID) {
        throw new BadRequestException('Payroll already marked as paid');
      }

      record.status = PayrollStatus.PAID;
      record.paidAt = new Date();
      record.paymentMethod = dto.paymentMethod;
      record.paymentReference = dto.paymentReference || null;
      record.paidBy = userId;
      record.notes = dto.notes || null;

      const saved = await queryRunner.manager.save(record);
      await queryRunner.commitTransaction();

      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MARK ON HOLD
  // ═══════════════════════════════════════════════════════════

  async markOnHold(
    recordId: string,
    organizationId: string,
  ): Promise<PayrollRecord> {
    const record = await this.payrollRepo.findOne({
      where: { id: recordId, organizationId },
    });

    if (!record) {
      throw new NotFoundException('Payroll record not found');
    }

    if (record.status === PayrollStatus.PAID) {
      throw new BadRequestException(
        'Cannot put a paid payroll record on hold',
      );
    }

    record.status = PayrollStatus.ON_HOLD;
    return this.payrollRepo.save(record);
  }
}
