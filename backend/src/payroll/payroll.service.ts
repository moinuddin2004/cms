import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PayrollRecord } from './entities/payroll-record.entity';
import { EmployeesService } from 'src/employees/employees.service';
import { GeneratePayrollDto } from './dto/generate-payroll.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { PayrollStatus } from './enums/payroll.enums';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

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
  constructor(
    @InjectRepository(PayrollRecord)
    private readonly payrollRepo: Repository<PayrollRecord>,
    private readonly employeesService: EmployeesService,
    private readonly dataSource: DataSource,
  ) {}

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
    const { month, year, locationId } = dto;
    const { organizationId } = ctx;

    // 1. Validate: month/year not in future
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (year > currentYear || (year === currentYear && month > currentMonth)) {
      throw new BadRequestException(
        'Cannot generate payroll for future months',
      );
    }

    // 2. Get all active employees for given location
    const employees = await this.employeesService.getActiveEmployeesByLocation(
      locationId,
      organizationId,
    );

    const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let generated = 0;
      let skipped = 0;
      const noSalary: string[] = [];
      const records: PayrollRecord[] = [];

      for (const employee of employees) {
        // 3a. Check if payroll record already exists
        const existing = await queryRunner.manager.findOne(PayrollRecord, {
          where: {
            employeeId: employee.id,
            month,
            year,
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // 3b. Get current salary
        const currentSalary = await this.employeesService.getCurrentSalary(
          employee.id,
        );

        if (!currentSalary) {
          noSalary.push(employee.fullName);
          continue;
        }

        // 3c. Create PayrollRecord with salary SNAPSHOT
        const record = queryRunner.manager.create(PayrollRecord, {
          employeeId: employee.id,
          organizationId,
          locationId,
          month,
          year,
          periodLabel,
          salaryAmount: currentSalary.grossSalary,
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
  // FIND BY LOCATION
  // ═══════════════════════════════════════════════════════════

  async findByLocation(
    locationId: string,
    month: number,
    year: number,
    organizationId: string,
  ): Promise<{
    records: PayrollRecord[];
    summary: {
      total: number;
      totalAmount: number;
      paidCount: number;
      pendingCount: number;
      onHoldCount: number;
      paidAmount: number;
      pendingAmount: number;
    };
  }> {
    const records = await this.payrollRepo.find({
      where: { locationId, month, year, organizationId },
      relations: ['employee'],
      order: { createdAt: 'DESC' },
    });

    const summary = records.reduce(
      (acc, r) => {
        const amount = Number(r.salaryAmount);
        acc.total++;
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
        total: 0,
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
