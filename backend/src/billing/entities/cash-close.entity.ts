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
import { MoneyColumn, moneyTransformer } from '../common/money-column';

/** Immutable count of the counter since the previous close (D23, 5.16). */
@Entity({ name: 'cash_closes' })
@Index(
  'uq_cash_closes_loc_end',
  ['organizationId', 'locationId', 'periodEnd'],
  { unique: true },
)
export class CashClose {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd: Date;

  @Column({ name: 'business_date', type: 'date' })
  businessDate: string;

  @Column({
    name: 'total_expected',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  totalExpected: number;

  @MoneyColumn('total_counted')
  totalCounted: number;

  @Column({
    name: 'total_variance',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  totalVariance: number;

  @Column({ name: 'note', type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ name: 'closed_by', type: 'uuid' })
  closedBy: string;

  @OneToMany(() => CashCloseLine, (l) => l.cashClose)
  lines: CashCloseLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

@Entity({ name: 'cash_close_lines' })
@Index('idx_cash_close_lines_close', ['cashCloseId'])
export class CashCloseLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CashClose, (c) => c.lines, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cash_close_id' })
  cashClose: CashClose;

  @Column({ name: 'cash_close_id', type: 'uuid' })
  cashCloseId: string;

  @Column({ name: 'payment_account_id', type: 'uuid' })
  paymentAccountId: string;

  @Column({ name: 'payment_account_name', type: 'varchar', length: 60 })
  paymentAccountName: string;

  @MoneyColumn('payments_total')
  paymentsTotal: number;

  @MoneyColumn('refunds_total')
  refundsTotal: number;

  @Column({ name: 'payment_count', type: 'int', default: 0 })
  paymentCount: number;

  @Column({ name: 'refund_count', type: 'int', default: 0 })
  refundCount: number;

  @Column({
    name: 'expected',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  expected: number;

  @MoneyColumn('counted', { nullable: true })
  counted: number | null;

  @Column({
    name: 'variance',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  variance: number;
}
