import {
  Check,
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
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { MoneyColumn, moneyTransformer } from '../common/money-column';
import { MinorColumn } from '../common/minor-column';
import { CompensationPlan } from '../commissions/entities/compensation-plan.entity';
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
 * Balance is never stored: `netAmount + taxAmount − allocatedAmount`.
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
@Check(
  'chk_charges_commission_rate',
  `"commission_rate_bps" IS NULL OR "commission_rate_bps" BETWEEN 0 AND 10000`,
)
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

  /*
   * Commission snapshot, taken when the charge is created from a visit:
   * who performed it (assignment = doctor × location), the plan active on
   * the clinic date and the resolved rate OR fixed amount. Null on old,
   * manual and salary-only charges, which earn no commission. Internal
   * clinic cost — never part of totals, invoices or prints.
   */
  @ManyToOne(() => EmployeeOrgLocationAssignment, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'performing_assignment_id' })
  performingAssignment: EmployeeOrgLocationAssignment | null;

  @Column({ name: 'performing_assignment_id', type: 'uuid', nullable: true })
  performingAssignmentId: string | null;

  @ManyToOne(() => CompensationPlan, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'commission_plan_id' })
  commissionPlan: CompensationPlan | null;

  @Column({ name: 'commission_plan_id', type: 'uuid', nullable: true })
  commissionPlanId: string | null;

  @Column({ name: 'commission_rate_bps', type: 'int', nullable: true })
  commissionRateBps: number | null;

  @MinorColumn('commission_fixed_minor', { nullable: true })
  commissionFixedMinor: number | null;

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

  /**
   * This charge's share of its invoice's sales tax (0 while unbilled).
   * Payable = net + tax; tax is not revenue and earns no commission.
   * Written only when the invoice is issued / edited / cancelled.
   */
  @MoneyColumn('tax_amount')
  taxAmount: number;

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
