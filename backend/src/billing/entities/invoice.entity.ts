import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { PatientTreatmentPlan } from 'src/patients/entities/patient-treatment-plan.entity';
import { InvoiceStatus, DiscountType } from '../enums/billing.enums';
import { InvoiceItem } from './invoice-item.entity';
import { Payment } from './payment.entity';
import { Coupon } from './coupon.entity';

@Entity({ name: 'invoices' })
@Index(['organizationId', 'locationId', 'status'])
@Index(['organizationId', 'patientId'])
@Index(['invoiceNumber'], { unique: true })
@Index(['dueDate'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_number', type: 'varchar', length: 30 })
  invoiceNumber: string;

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

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => PatientTreatmentPlan, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'treatment_plan_id' })
  treatmentPlan: PatientTreatmentPlan | null;

  @Column({ name: 'treatment_plan_id', type: 'uuid', nullable: true })
  treatmentPlanId: string | null;

  @ManyToOne(() => Employee, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: Employee | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'subtotal', type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({
    name: 'discount_type',
    type: 'enum',
    enum: DiscountType,
    nullable: true,
  })
  discountType: DiscountType | null;

  @Column({ name: 'discount_value', type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountValue: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  discountAmount: number;

  @ManyToOne(() => Coupon, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'coupon_id' })
  coupon: Coupon | null;

  @Column({ name: 'coupon_id', type: 'uuid', nullable: true })
  couponId: string | null;

  @Column({ name: 'tax_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ name: 'balance_due', type: 'decimal', precision: 10, scale: 2, default: 0 })
  balanceDue: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column({ name: 'issued_date', type: 'date', nullable: true })
  issuedDate: Date | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({ name: 'paid_date', type: 'date', nullable: true })
  paidDate: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @OneToMany(() => Payment, (payment) => payment.invoice)
  payments: Payment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
