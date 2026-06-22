import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Employee } from 'src/employees/entities/employee.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Location } from 'src/locations/entities/location.entity';
import { PayrollStatus, PaymentMethod } from '../enums/payroll.enums';

@Entity({ name: 'payroll_records' })
@Unique(['employeeId', 'month', 'year'])
@Index(['organizationId', 'locationId', 'month', 'year'])
@Index(['employeeId', 'year'])
export class PayrollRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'month', type: 'int' })
  month: number;

  @Column({ name: 'year', type: 'int' })
  year: number;

  @Column({ name: 'period_label', type: 'varchar', length: 50 })
  periodLabel: string;

  @Column({
    name: 'salary_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  salaryAmount: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PayrollStatus,
    default: PayrollStatus.PENDING,
  })
  status: PayrollStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  paymentMethod: PaymentMethod | null;

  @Column({ name: 'payment_reference', type: 'varchar', nullable: true })
  paymentReference: string | null;

  @Column({ name: 'paid_by', type: 'uuid', nullable: true })
  paidBy: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
