import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentMethod } from '../enums/billing.enums';

/** A location's way to receive money: Cash, Meezan Bank, JazzCash… (D20). */
@Entity({ name: 'payment_accounts' })
@Index(
  'uq_payment_accounts_loc_name',
  ['organizationId', 'locationId', 'name'],
  {
    unique: true,
  },
)
export class PaymentAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'name', type: 'varchar', length: 60 })
  name: string;

  @Column({ name: 'method', type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ name: 'bank_name', type: 'varchar', length: 80, nullable: true })
  bankName: string | null;

  @Column({
    name: 'account_title',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  accountTitle: string | null;

  @Column({
    name: 'account_number',
    type: 'varchar',
    length: 40,
    nullable: true,
  })
  accountNumber: string | null;

  @Column({ name: 'requires_reference', type: 'boolean', default: false })
  requiresReference: boolean;

  @Column({ name: 'counted_in_cash_close', type: 'boolean', default: false })
  countedInCashClose: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
