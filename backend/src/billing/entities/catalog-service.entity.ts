import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MoneyColumn } from '../common/money-column';
import { ServiceKind } from '../enums/billing.enums';
import { ServicePrice } from './service-price.entity';

/** Org-level service catalog: consultation, procedures, other (D5). */
@Entity({ name: 'services' })
@Index('uq_services_org_name', ['organizationId', 'name'], { unique: true })
@Index('uq_services_org_code', ['organizationId', 'code'], {
  unique: true,
  where: 'code IS NOT NULL',
})
@Index('idx_services_org_active_kind', ['organizationId', 'isActive', 'kind'])
export class CatalogService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'name', type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'code', type: 'varchar', length: 30, nullable: true })
  code: string | null;

  @Column({ name: 'kind', type: 'enum', enum: ServiceKind })
  kind: ServiceKind;

  @MoneyColumn('default_price')
  defaultPrice: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => ServicePrice, (p) => p.service)
  prices: ServicePrice[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
