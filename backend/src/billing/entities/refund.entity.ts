import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Patient } from 'src/patients/entities/patient.entity';
import { MoneyColumn } from '../common/money-column';
import { PaymentMethod } from '../enums/billing.enums';
import { RefundSource } from './refund-source.entity';

/**
 * Money returned to a patient, always taken from advance (D14).
 * `invoiceId` set = invoice refund (6.18); null = advance refund.
 */
@Entity({ name: 'refunds' })
@Index('uq_refunds_org_number', ['organizationId', 'refundNumber'], {
  unique: true,
})
@Index('uq_refunds_org_client_request', ['organizationId', 'clientRequestId'], {
  unique: true,
})
@Index('idx_refunds_patient', ['organizationId', 'locationId', 'patientId'])
@Index('idx_refunds_invoice', ['invoiceId'])
@Index('idx_refunds_account_refunded', ['paymentAccountId', 'refundedAt'])
export class Refund {
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

  @Column({ name: 'refund_number', type: 'varchar', length: 30 })
  refundNumber: string;

  @MoneyColumn('amount')
  amount: number;

  @Column({ name: 'payment_account_id', type: 'uuid' })
  paymentAccountId: string;

  @Column({ name: 'method', type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ name: 'payment_account_name', type: 'varchar', length: 60 })
  paymentAccountName: string;

  @Column({
    name: 'reference_number',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  referenceNumber: string | null;

  @Column({ name: 'reason', type: 'varchar', length: 300 })
  reason: string;

  @Column({ name: 'refund_date', type: 'date' })
  refundDate: string;

  @Column({ name: 'refunded_at', type: 'timestamptz' })
  refundedAt: Date;

  @Column({ name: 'refunded_by', type: 'uuid' })
  refundedBy: string;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  @Column({ name: 'client_request_id', type: 'uuid' })
  clientRequestId: string;

  @OneToMany(() => RefundSource, (s) => s.refund)
  sources: RefundSource[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
