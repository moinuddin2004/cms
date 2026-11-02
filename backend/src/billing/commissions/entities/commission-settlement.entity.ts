import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { PayrollRecord } from 'src/payroll/entities/payroll-record.entity';
import { MinorColumn } from '../../common/minor-column';
import { CommissionSettlementStatus } from '../commission.enums';

/**
 * A batch of unsettled commission entries of one assignment, paid through
 * one payroll record. Entries keep their amounts; they only point here.
 */
@Entity({ name: 'commission_settlements' })
@Index('idx_commission_settlements_assignment', ['assignmentId', 'periodEnd'])
export class CommissionSettlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => EmployeeOrgLocationAssignment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: EmployeeOrgLocationAssignment;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  /** Signed: a period with only reversals can be negative. */
  @MinorColumn('total_minor')
  totalMinor: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: CommissionSettlementStatus,
    default: CommissionSettlementStatus.PENDING,
  })
  status: CommissionSettlementStatus;

  @OneToOne(() => PayrollRecord, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'payroll_record_id' })
  payrollRecord: PayrollRecord | null;

  @Column({ name: 'payroll_record_id', type: 'uuid', nullable: true })
  payrollRecordId: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'paid_by', type: 'uuid', nullable: true })
  paidBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
