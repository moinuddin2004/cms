import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MoneyColumn, moneyTransformer } from '../common/money-column';
import {
  DiscountAppliesTo,
  DiscountKind,
  ServiceKind,
} from '../enums/billing.enums';

/** Owner-defined discount preset, evolved from coupons (D8, 5.6). */
@Entity({ name: 'discount_types' })
@Index('uq_discount_types_org_name', ['organizationId', 'name'], {
  unique: true,
})
@Index('uq_discount_types_org_code', ['organizationId', 'code'], {
  unique: true,
  where: 'code IS NOT NULL',
})
export class DiscountType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'name', type: 'varchar', length: 80 })
  name: string;

  @Column({ name: 'code', type: 'varchar', length: 30, nullable: true })
  code: string | null;

  @Column({ name: 'kind', type: 'enum', enum: DiscountKind })
  kind: DiscountKind;

  @Column({
    name: 'value',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
  })
  value: number;

  @MoneyColumn('max_amount', { nullable: true })
  maxAmount: number | null;

  @Column({
    name: 'applies_to',
    type: 'enum',
    enum: DiscountAppliesTo,
    default: DiscountAppliesTo.ALL,
  })
  appliesTo: DiscountAppliesTo;

  @Column({
    name: 'service_kinds',
    type: 'enum',
    enum: ServiceKind,
    array: true,
    nullable: true,
  })
  serviceKinds: ServiceKind[] | null;

  @Column({ name: 'service_ids', type: 'uuid', array: true, nullable: true })
  serviceIds: string[] | null;

  @Column({ name: 'reception_editable', type: 'boolean', default: false })
  receptionEditable: boolean;

  @Column({
    name: 'min_value',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: moneyTransformer,
  })
  minValue: number | null;

  @Column({
    name: 'max_value',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: moneyTransformer,
  })
  maxValue: number | null;

  @Column({ name: 'requires_note', type: 'boolean', default: false })
  requiresNote: boolean;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom: string | null;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
