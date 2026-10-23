import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from 'src/patients/entities/patient.entity';
import { MoneyColumn } from '../common/money-column';
import { InvoiceStatus } from '../enums/billing.enums';
import { Charge } from './charge.entity';

/**
 * An issued document grouping charges (D2). No drafts: it is created and
 * issued in one step. Cached money columns are written only by
 * BillingTotalsService (6.12); payment / refund status is computed (6.13).
 */
@Entity({ name: 'invoices' })
@Index('uq_invoices_org_number', ['organizationId', 'invoiceNumber'], {
  unique: true,
})
@Index('idx_invoices_patient', ['organizationId', 'locationId', 'patientId'])
@Index('idx_invoices_issue_date', ['organizationId', 'locationId', 'issueDate'])
@Index('idx_invoices_open', [
  'organizationId',
  'locationId',
  'status',
  'balanceDue',
])
export class Invoice {
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

  @Column({ name: 'invoice_number', type: 'varchar', length: 30 })
  invoiceNumber: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.ISSUED,
  })
  status: InvoiceStatus;

  @Column({ name: 'revision', type: 'int', default: 1 })
  revision: number;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @MoneyColumn('subtotal')
  subtotal: number;

  @MoneyColumn('discount_total')
  discountTotal: number;

  /**
   * Sales-tax rate (%) snapshotted from the location's settings when the
   * invoice was issued. Edits re-apply this rate; later setting changes
   * never touch it. 0 = no tax (and every pre-tax invoice).
   */
  @Column({
    name: 'tax_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number | null | undefined) => value,
      from: (value: string | null) => (value === null ? 0 : Number(value)),
    },
  })
  taxRate: number;

  /** Exclusive tax = SUM(ACTIVE charges.tax_amount) = round(net × rate). */
  @MoneyColumn('tax_amount')
  taxAmount: number;

  /** subtotal − discount + tax. */
  @MoneyColumn('total_amount')
  totalAmount: number;

  @MoneyColumn('paid_amount')
  paidAmount: number;

  @MoneyColumn('balance_due')
  balanceDue: number;

  /** Money released from this invoice to advance (edit releases + unapply). */
  @MoneyColumn('released_amount')
  releasedAmount: number;

  /** SUM(refunds.amount) recorded against this invoice. */
  @MoneyColumn('refunded_amount')
  refundedAmount: number;

  @Column({ name: 'notes', type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ name: 'issued_by', type: 'uuid' })
  issuedBy: string;

  @Column({ name: 'last_edited_at', type: 'timestamptz', nullable: true })
  lastEditedAt: Date | null;

  @Column({ name: 'last_edited_by', type: 'uuid', nullable: true })
  lastEditedBy: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledBy: string | null;

  @Column({
    name: 'cancel_reason',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  cancelReason: string | null;

  @OneToMany(() => Charge, (c) => c.invoice)
  charges: Charge[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
