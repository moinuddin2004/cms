import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Master catalog of every feature the platform offers.
 * One row per feature; org-level toggles live in org_feature_flags.
 */
@Entity({ name: 'feature_catalog' })
@Index(['key'], { unique: true })
@Index(['module'])
@Index(['isActive'])
export class FeatureCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Machine key, e.g. 'billing.invoices', 'comms.whatsapp' */
  @Column({ name: 'key', type: 'varchar', length: 100, unique: true })
  key: string;

  /** Human-readable label */
  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  /** Grouping module, e.g. 'billing', 'appointments', 'patients' */
  @Column({ name: 'module', type: 'varchar', length: 100 })
  module: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  /** Clinic types this feature is relevant to: general, dental, skin, ortho, physio, eye */
  @Column({ name: 'specialty_tags', type: 'jsonb', default: '["general"]' })
  specialtyTags: string[];

  @Column({ name: 'enabled_by_default', type: 'boolean', default: false })
  enabledByDefault: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
