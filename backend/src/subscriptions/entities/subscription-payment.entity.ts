import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from 'src/organizations/entities/organization.entity';
import { SubscriptionPlan } from 'src/common/enums/subscription-plan.enum';

export const SUBSCRIPTION_PAYMENT_METHODS = [
  'bank_transfer',
  'jazzcash',
  'easypaisa',
  'cash',
  'cheque',
  'other',
] as const;
export type SubscriptionPaymentMethod =
  (typeof SUBSCRIPTION_PAYMENT_METHODS)[number];

/**
 * A clinic's payment for its subscription, collected outside the app and
 * recorded by a super admin. Each one extends `organizations.paid_until`.
 */
@Entity({ name: 'subscription_payments' })
@Index(['organizationId', 'paidAt'])
export class SubscriptionPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'plan', type: 'enum', enum: SubscriptionPlan })
  plan: SubscriptionPlan;

  @Column({ name: 'months', type: 'int' })
  months: number;

  /** PKR. */
  @Column({ name: 'amount', type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'method', type: 'varchar', length: 30 })
  method: SubscriptionPaymentMethod;

  @Column({ name: 'reference', type: 'varchar', length: 120, nullable: true })
  reference: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz' })
  paidAt: Date;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd: Date;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
