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
import { ClockService } from 'src/common/clock/clock.service';
import { addDays } from 'src/common/clock/tz.util';
import { rupeesToMinor } from 'src/billing/commissions/commission-math';
import { CompensationPlanVersions } from 'src/billing/commissions/compensation-plan-versions';
import {
  CommissionSettlements,
  minorToDecimal,
} from 'src/billing/commissions/commission-settlements';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
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
    private readonly clock: ClockService,
  ) {}

  /** First and last clinic date of a payroll month. */
  private period(month: number, year: number): { start: string; end: string } {
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = `${year}-${pad(month)}-01`;
    const next =
      month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
    return { start, end: addDays(next, -1) };
  }

  /** Rupee amount from a DTO → exact minor units (no float math). */
  private minorOf(rupees: number): number {
    const minor = rupeesToMinor(rupees);
    if (minor === null) {
      throw new BadRequestException('Amount must have at most 2 decimals');
    }
    return minor;
  }

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

    // Validate: month/year not in future (clinic calendar of the location)
    const tz = await this.clock.timezoneFor(ctx.locationId);
    const [currentYear, currentMonth] = this.clock
      .today(tz)
      .split('-')
      .map(Number);

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

      const m = queryRunner.manager;
      const period = this.period(month, year);
      const tz = await this.clock.timezoneFor(locationId);
      // Commission up to the end of the period's last clinic day.
      const periodEndsAt = this.clock.dayRange(
        tz,
        addDays(period.end, 1),
      ).start;

      for (const assignment of assignments) {
        // Payroll is UNIQUE per assignment (employee × location) per month.
        const existing = await m.findOne(PayrollRecord, {
          where: { employeeId: assignment.employeeId, locationId, month, year },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // The plan in force at the end of the period (else at its start);
        // assignments never migrated to plans fall back to gross_salary.
        const plan =
          (await CompensationPlanVersions.activeOn(
            m,
            assignment.id,
            period.end,
          )) ??
          (await CompensationPlanVersions.activeOn(
            m,
            assignment.id,
            period.start,
          ));
        const baseMinor = plan
          ? (plan.baseSalaryMinor ?? 0)
          : assignment.grossSalary
            ? (rupeesToMinor(String(assignment.grossSalary)) ?? 0)
            : 0;

        // Commission: every unsettled entry up to period end, locked FOR
        // UPDATE. A net-negative balance (only reversals) is not settled; it
        // carries into the next period and offsets later earnings.
        const entries = await CommissionSettlements.lockUnsettled(
          m,
          assignment.id,
          periodEndsAt,
        );
        const settle = entries.ids.length > 0 && entries.totalMinor >= 0;
        const commissionMinor = settle ? entries.totalMinor : 0;

        if (baseMinor === 0 && commissionMinor === 0) {
          noSalary.push(assignment.employee.fullName);
          continue;
        }

        // Pay SNAPSHOT at time of generation (salary + commission).
        const totalMinor = baseMinor + commissionMinor;
        const record = m.create(PayrollRecord, {
          employeeId: assignment.employeeId,
          organizationId,
          locationId,
          month,
          year,
          periodLabel,
          salaryAmount: minorToDecimal(totalMinor) as unknown as number,
          baseSalaryMinor: baseMinor,
          commissionMinor,
          totalMinor,
          status: PayrollStatus.PENDING,
          createdBy: userId,
        });

        const saved = await m.save(record);
        if (settle) {
          await CommissionSettlements.create(m, {
            organizationId,
            locationId,
            assignmentId: assignment.id,
            periodStart: period.start,
            periodEnd: period.end,
            payrollRecordId: saved.id,
            entries,
          });
        }
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
      where: {
        employeeId: dto.employeeId,
        locationId: ctx.locationId,
        month: dto.month,
        year: dto.year,
      },
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
      baseSalaryMinor: this.minorOf(dto.salaryAmount),
      commissionMinor: 0,
      totalMinor: this.minorOf(dto.salaryAmount),
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

    if (dto.salaryAmount !== undefined) {
      // The amount is the total; settled commission stays as it is.
      const total = this.minorOf(dto.salaryAmount);
      if (total < record.commissionMinor) {
        throw new BadRequestException(
          'The amount cannot be below the commission already in this payroll',
        );
      }
      record.salaryAmount = dto.salaryAmount;
      record.totalMinor = total;
      record.baseSalaryMinor = total - record.commissionMinor;
    }
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
    await this.dataSource.transaction(async (m) => {
      const record = await m.findOne(PayrollRecord, {
        where: { id: recordId, organizationId },
      });
      if (!record) {
        throw new NotFoundException('Payroll record not found');
      }
      // Its commission goes back to the unsettled pool (refused once paid).
      if ((await CommissionSettlements.release(m, record.id)) === 'paid') {
        throw new BadRequestException(
          'This payroll paid out commission and cannot be deleted',
        );
      }
      await m.remove(record);
    });
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
      /** Minor breakdown of all records of the month. */
      baseSalaryMinor: number;
      commissionMinor: number;
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
        acc.baseSalaryMinor += r.totalMinor
          ? r.baseSalaryMinor
          : (rupeesToMinor(String(r.salaryAmount)) ?? 0);
        acc.commissionMinor += r.commissionMinor;

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
        baseSalaryMinor: 0,
        commissionMinor: 0,
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
      record.paidAt = this.clock.now();
      record.paymentMethod = dto.paymentMethod;
      record.paymentReference = dto.paymentReference || null;
      record.paidBy = userId;
      record.notes = dto.notes || null;

      const saved = await queryRunner.manager.save(record);
      // The linked commission settlement is paid with it.
      await CommissionSettlements.markPaid(
        queryRunner.manager,
        record.id,
        record.paidAt,
        userId,
      );
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
      throw new BadRequestException('Cannot put a paid payroll record on hold');
    }

    record.status = PayrollStatus.ON_HOLD;
    return this.payrollRepo.save(record);
  }
}
