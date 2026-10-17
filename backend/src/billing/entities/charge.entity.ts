import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from 'src/patients/entities/patient.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { MoneyColumn, moneyTransformer } from '../common/money-column';
import {
  ChargeSource,
  ChargeStatus,
  DiscountKind,
  ServiceKind,
} from '../enums/billing.enums';
import { Invoice } from './invoice.entity';

/**
 * One billable line for a patient — the atomic unit of billing (D1).
 * `invoiceId = null` means unbilled. Price, discount and service kind are
 * snapshots: catalog changes never touch existing charges (D5).
 * Balance is never stored: `netAmount − allocatedAmount`.
 */
@Entity({ name: 'charges' })
@Index('idx_charges_patient_open', [
  'organizationId',
  'locationId',
  'patientId',
  'status',
  'invoiceId',
])
@Index('idx_charges_invoice', ['invoiceId'])
@Index('idx_charges_date', ['organizationId', 'locationId', 'chargeDate'])
@Index('uq_charges_source', ['organizationId', 'source', 'sourceId'], {
  unique: true,
  where: `status = 'ACTIVE' AND source_id IS NOT NULL`,
})
export class Charge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'source', type: 'enum', enum: ChargeSource })
  source: ChargeSource;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string | null;

  /** The visit (patient encounter) the charge comes from, when known. */
  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId: string | null;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Employee | null;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string | null;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  /** Snapshot; MANUAL "Other" charges count as OTHER for discount rules. */
  @Column({
    name: 'service_kind',
    type: 'enum',
    enum: ServiceKind,
    default: ServiceKind.OTHER,
  })
  serviceKind: ServiceKind;

  @Column({ name: 'description', type: 'varchar', length: 200 })
  description: string;

  @Column({ name: 'quantity', type: 'int', default: 1 })
  quantity: number;

  @MoneyColumn('unit_price')
  unitPrice: number;

  @MoneyColumn('gross_amount')
  grossAmount: number;

  @Column({ name: 'discount_type_id', type: 'uuid', nullable: true })
  discountTypeId: string | null;

  @Column({
    name: 'discount_name',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  discountName: string | null;

  @Column({
    name: 'discount_kind',
    type: 'enum',
    enum: DiscountKind,
    nullable: true,
  })
  discountKind: DiscountKind | null;

  @Column({
    name: 'discount_value',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: moneyTransformer,
  })
  discountValue: number | null;

  @MoneyColumn('discount_amount')
  discountAmount: number;

  @Column({
    name: 'discount_note',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  discountNote: string | null;

  @Column({ name: 'discount_applied_by', type: 'uuid', nullable: true })
  discountAppliedBy: string | null;

  @Column({ name: 'is_custom_discount', type: 'boolean', default: false })
  isCustomDiscount: boolean;

  @MoneyColumn('net_amount')
  netAmount: number;

  /** Cached = SUM(allocations.amount); written only by BillingTotalsService. */
  @MoneyColumn('allocated_amount')
  allocatedAmount: number;

  @ManyToOne(() => Invoice, (i) => i.charges, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice | null;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ name: 'charge_date', type: 'date' })
  chargeDate: string;

  @Column({ name: 'needs_pricing', type: 'boolean', default: false })
  needsPricing: boolean;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ChargeStatus,
    default: ChargeStatus.ACTIVE,
  })
  status: ChargeStatus;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  @Column({ name: 'voided_by', type: 'uuid', nullable: true })
  voidedBy: string | null;

  @Column({ name: 'void_reason', type: 'varchar', length: 300, nullable: true })
  voidReason: string | null;

  /** Set when the doctor removed the source treatment after billing (6.4). */
  @Column({ name: 'source_removed_at', type: 'timestamptz', nullable: true })
  sourceRemovedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
