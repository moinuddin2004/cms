import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MoneyColumn } from '../common/money-column';
import { Payment } from './payment.entity';
import { Refund } from './refund.entity';

/** Which payment's advance funded a refund. SUM = refund.amount (I7). */
@Entity({ name: 'refund_sources' })
@Index('idx_refund_sources_refund', ['refundId'])
@Index('idx_refund_sources_payment', ['paymentId'])
export class RefundSource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Refund, (r) => r.sources, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'refund_id' })
  refund: Refund;

  @Column({ name: 'refund_id', type: 'uuid' })
  refundId: string;

  @ManyToOne(() => Payment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId: string;

  @MoneyColumn('amount')
  amount: number;
}
