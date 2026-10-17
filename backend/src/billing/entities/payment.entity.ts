import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Patient } from 'src/patients/entities/patient.entity';
import { MoneyColumn } from '../common/money-column';
import { PaymentMethod } from '../enums/billing.enums';
import { PaymentAccount } from './payment-account.entity';

/**
 * Money received from a patient (D6, D12). Belongs to the patient, not to
 * an invoice; immutable except the cached `allocatedAmount` /
 * `refundedAmount`. Advance = amount − allocated − refunded.
 */
@Entity({ name: 'payments' })
@Index('uq_payments_org_receipt', ['organizationId', 'receiptNumber'], {
  unique: true,
})
@Index(
  'uq_payments_org_client_request',
  ['organizationId', 'clientRequestId'],
  { unique: true },
)
@Index('idx_payments_patient', ['organizationId', 'locationId', 'patientId'])
@Index('idx_payments_date', ['organizationId', 'locationId', 'paymentDate'])
@Index('idx_payments_account_received', ['paymentAccountId', 'receivedAt'])
export class Payment {
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

  @Column({ name: 'receipt_number', type: 'varchar', length: 30 })
  receiptNumber: string;

  @MoneyColumn('amount')
  amount: number;

  @ManyToOne(() => PaymentAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_account_id' })
  paymentAccount: PaymentAccount;

  @Column({ name: 'payment_account_id', type: 'uuid' })
  paymentAccountId: string;

  /** Snapshot of the account's kind at payment time. */
  @Column({ name: 'method', type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  /** Snapshot of the account's name. */
  @Column({ name: 'payment_account_name', type: 'varchar', length: 60 })
  paymentAccountName: string;

  @Column({
    name: 'reference_number',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  referenceNumber: string | null;

  @Column({ name: 'payment_date', type: 'date' })
  paymentDate: string;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'received_by', type: 'uuid' })
  receivedBy: string;

  @Column({ name: 'notes', type: 'varchar', length: 300, nullable: true })
  notes: string | null;

  @MoneyColumn('allocated_amount')
  allocatedAmount: number;

  @MoneyColumn('refunded_amount')
  refundedAmount: number;

  @Column({ name: 'client_request_id', type: 'uuid' })
  clientRequestId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
