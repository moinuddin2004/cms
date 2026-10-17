import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { moneyTransformer } from '../common/money-column';
import { AllocationReason } from '../enums/billing.enums';
import { Charge } from './charge.entity';
import { Payment } from './payment.entity';

/**
 * Append-only, signed: "X of payment P applied to charge C" (+) or
 * released back to advance (−). Never updated or deleted (D13).
 */
@Entity({ name: 'payment_allocations' })
@Check('chk_payment_allocations_amount_nonzero', 'amount <> 0')
@Index('idx_payment_allocations_payment', ['paymentId'])
@Index('idx_payment_allocations_charge', ['chargeId'])
@Index('idx_payment_allocations_invoice', ['invoiceId'])
export class PaymentAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Payment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @ManyToOne(() => Charge, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'charge_id' })
  charge: Charge;

  @Column({ name: 'charge_id', type: 'uuid' })
  chargeId: string;

  /** Copy of the charge's invoice at write time (fast invoice queries). */
  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({
    name: 'amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  amount: number;

  @Column({ name: 'reason', type: 'enum', enum: AllocationReason })
  reason: AllocationReason;

  @Column({ name: 'note', type: 'varchar', length: 300, nullable: true })
  note: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
