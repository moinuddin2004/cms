import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { CreditPackage } from './credit-package.entity';
import { CreditStatus } from '../enums/billing.enums';

@Entity({ name: 'patient_credits' })
@Index(['patientId', 'organizationId', 'status'])
export class PatientCredit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => CreditPackage, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'credit_package_id' })
  creditPackage: CreditPackage | null;

  @Column({ name: 'credit_package_id', type: 'uuid', nullable: true })
  creditPackageId: string | null;

  @ManyToOne(() => Employee, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'purchased_by' })
  purchaser: Employee | null;

  @Column({ name: 'purchased_by', type: 'uuid', nullable: true })
  purchasedBy: string | null;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ name: 'used_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  usedAmount: number;

  @Column({ name: 'remaining_amount', type: 'decimal', precision: 10, scale: 2 })
  remainingAmount: number;

  @Column({ name: 'purchase_date', type: 'date' })
  purchaseDate: Date;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: CreditStatus,
    default: CreditStatus.ACTIVE,
  })
  status: CreditStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
