import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { MinorColumn } from 'src/billing/common/minor-column';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { Patient } from 'src/patients/entities/patient.entity';
import {
  LabCreditNoteStatus,
  LabPaymentMethod,
} from '../enums/lab-billing.enums';
import { LabInvoice } from './lab-invoice.entity';
import { LabPayment } from './lab-payment.entity';

/**
 * Corrects an issued invoice downwards (lab ERD §6a) — a cancelled or
 * reduced job. It lowers the invoice's balance; whatever the patient had
 * already paid above the new total is released from allocations back to
 * advance (`released_minor`) and can then be refunded. Never deleted.
 */
@Entity({ name: 'lab_credit_notes' })
@Unique('uq_lab_credit_notes_org_no', ['organizationId', 'creditNoteNo'])
@Check(
  'chk_lab_credit_notes_amounts',
  `"amount_minor" > 0 AND "released_minor" BETWEEN 0 AND "amount_minor" AND "refunded_minor" BETWEEN 0 AND "released_minor"`,
)
@Index('idx_lab_credit_notes_invoice', ['invoiceId'])
export class LabCreditNote {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'credit_note_no', type: 'varchar', length: 30 })
  creditNoteNo: string;

  @ManyToOne(() => LabInvoice, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: LabInvoice;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @MinorColumn('amount_minor')
  amountMinor: number;

  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: LabCreditNoteStatus,
  })
  status: LabCreditNoteStatus;

  /** Paid money taken off the invoice into the patient's advance. */
  @MinorColumn('released_minor')
  releasedMinor: number;

  /** Σ refunds against this note (cached). */
  @MinorColumn('refunded_minor')
  refundedMinor: number;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}

/**
 * Money paid back to a patient, always out of advance (billing v2 D14):
 * `lab_refund_sources` say which payments funded it. `credit_note_id` set =
 * the payout of a credit note (lab ERD §6a "paid out as").
 */
@Entity({ name: 'lab_refunds' })
@Unique('uq_lab_refunds_org_no', ['organizationId', 'refundNo'])
@Unique('uq_lab_refunds_org_idempotency', ['organizationId', 'idempotencyKey'])
@Check('chk_lab_refunds_amount', `"amount_minor" > 0`)
@Index('idx_lab_refunds_patient', ['organizationId', 'patientId'])
@Index('idx_lab_refunds_credit_note', ['creditNoteId'])
export class LabRefund {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'refund_no', type: 'varchar', length: 30 })
  refundNo: string;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => LabCreditNote, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'credit_note_id' })
  creditNote: LabCreditNote | null;

  @Column({ name: 'credit_note_id', type: 'uuid', nullable: true })
  creditNoteId: string | null;

  @MinorColumn('amount_minor')
  amountMinor: number;

  @Column({
    name: 'method',
    type: 'enum',
    enum: LabPaymentMethod,
  })
  method: LabPaymentMethod;

  @Column({ name: 'reference', type: 'varchar', length: 80, nullable: true })
  reference: string | null;

  @Column({ name: 'reason', type: 'text' })
  reason: string;

  @Column({ name: 'refunded_at', type: 'timestamptz' })
  refundedAt: Date;

  @Column({ name: 'refunded_by', type: 'uuid' })
  refundedBy: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 150 })
  idempotencyKey: string;

  @OneToMany(() => LabRefundSource, (s) => s.refund)
  sources: LabRefundSource[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

/** Which payment's advance funded a refund. Σ = refund amount. */
@Entity({ name: 'lab_refund_sources' })
@Check('chk_lab_refund_sources_amount', `"amount_minor" > 0`)
@Index('idx_lab_refund_sources_refund', ['refundId'])
@Index('idx_lab_refund_sources_payment', ['paymentId'])
export class LabRefundSource {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => LabRefund, (r) => r.sources, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'refund_id' })
  refund: LabRefund;

  @Column({ name: 'refund_id', type: 'uuid' })
  refundId: string;

  @ManyToOne(() => LabPayment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_id' })
  payment: LabPayment;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @MinorColumn('amount_minor')
  amountMinor: number;
}

/**
 * Per-clinic lab billing defaults (decision: tax in basis points, default
 * 0 until the accountant confirms). Missing row = defaults.
 */
@Entity({ name: 'lab_billing_settings' })
@Check(
  'chk_lab_billing_settings',
  `"tax_rate_bp" BETWEEN 0 AND 10000 AND "due_days" BETWEEN 0 AND 365`,
)
export class LabBillingSettings {
  @PrimaryColumn({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'tax_rate_bp', type: 'int', default: 0 })
  taxRateBp: number;

  /** Days from issue to due date. */
  @Column({ name: 'due_days', type: 'int', default: 0 })
  dueDays: number;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}
