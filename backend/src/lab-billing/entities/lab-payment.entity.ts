import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { MinorColumn } from 'src/billing/common/minor-column';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { Patient } from 'src/patients/entities/patient.entity';
import {
  AllocationReleaseReason,
  LabPaymentMethod,
  LabPaymentStatus,
} from '../enums/lab-billing.enums';
import { LabInvoice } from './lab-invoice.entity';

/**
 * Money received from a patient for lab work (lab ERD §6a). Belongs to the
 * patient, not an invoice (billing v2 D6): the part not allocated or
 * refunded is the patient's advance. Immutable except the cached
 * `allocated_minor` / `refunded_minor` and `status`. A wrong payment is
 * never deleted: it is reversed by a mirror row (negative amount,
 * `reversal_of_id`) — at most one per payment.
 */
@Entity({ name: 'lab_payments' })
@Unique('uq_lab_payments_org_receipt', ['organizationId', 'receiptNo'])
@Unique('uq_lab_payments_org_idempotency', ['organizationId', 'idempotencyKey'])
@Unique('uq_lab_payments_reversal_of', ['reversalOfId'])
@Check(
  'chk_lab_payments_amounts',
  `"amount_minor" <> 0 AND "allocated_minor" >= 0 AND "refunded_minor" >= 0 AND ("reversal_of_id" IS NULL) = ("amount_minor" > 0) AND "allocated_minor" + "refunded_minor" <= GREATEST("amount_minor", 0)`,
)
@Index('idx_lab_payments_patient', ['organizationId', 'patientId'])
@Index('idx_lab_payments_received', ['organizationId', 'receivedOn'])
export class LabPayment {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'receipt_no', type: 'varchar', length: 30 })
  receiptNo: string;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  /** Negative on a reversal row. */
  @MinorColumn('amount_minor')
  amountMinor: number;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'PKR' })
  currency: string;

  @Column({
    name: 'method',
    type: 'enum',
    enum: LabPaymentMethod,
  })
  method: LabPaymentMethod;

  @Column({ name: 'reference', type: 'varchar', length: 80, nullable: true })
  reference: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  /** Location-local day of `received_at` (reports, cash close). */
  @Column({ name: 'received_on', type: 'date' })
  receivedOn: string;

  @Column({ name: 'received_by', type: 'uuid' })
  receivedBy: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: LabPaymentStatus,
    default: LabPaymentStatus.POSTED,
  })
  status: LabPaymentStatus;

  @ManyToOne(() => LabPayment, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reversal_of_id' })
  reversalOf: LabPayment | null;

  @Column({ name: 'reversal_of_id', type: 'uuid', nullable: true })
  reversalOfId: string | null;

  /** On the reversal row: why. */
  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  /** Σ active allocations (cached). */
  @MinorColumn('allocated_minor')
  allocatedMinor: number;

  /** Σ refund sources (cached). */
  @MinorColumn('refunded_minor')
  refundedMinor: number;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 150 })
  idempotencyKey: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/**
 * "X of payment P settles invoice I". Positive, and never deleted: a
 * reversal or a credit note stops it counting by setting `reversed_at`
 * (lab ERD §10). Inv. 5: Σ active allocations of a payment ≤ its amount.
 */
@Entity({ name: 'lab_payment_allocations' })
@Check('chk_lab_payment_allocations_amount', `"amount_minor" > 0`)
@Index('idx_lab_payment_allocations_payment', ['paymentId'])
@Index('idx_lab_payment_allocations_invoice', ['invoiceId'])
export class LabPaymentAllocation {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => LabPayment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_id' })
  payment: LabPayment;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => LabInvoice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: LabInvoice;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @MinorColumn('amount_minor')
  amountMinor: number;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'reversed_at', type: 'timestamptz', nullable: true })
  reversedAt: Date | null;

  @Column({ name: 'reversed_by', type: 'uuid', nullable: true })
  reversedBy: string | null;

  @Column({
    name: 'release_reason',
    type: 'enum',
    enum: AllocationReleaseReason,
    nullable: true,
  })
  releaseReason: AllocationReleaseReason | null;
}
