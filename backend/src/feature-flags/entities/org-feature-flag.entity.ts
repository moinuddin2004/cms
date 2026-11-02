import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Organization } from 'src/organizations/entities/organization.entity';

/**
 * Per-organization state of a catalog feature:
 *
 * - `is_entitled` — set by the super admin: the org may use the feature
 *   (until `entitled_until` when that is set — a trial expiry).
 * - `is_enabled` — the clinic owner's switch.
 *
 * Active = active catalog entry ∧ entitled (not expired) ∧ enabled.
 * featureKey is denormalized from feature_catalog for fast lookups.
 */
@Entity({ name: 'org_feature_flags' })
@Unique(['organizationId', 'featureKey'])
@Index(['organizationId', 'isEnabled'])
export class OrgFeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /** Denormalized from feature_catalog.key */
  @Column({ name: 'feature_key', type: 'varchar', length: 100 })
  featureKey: string;

  @Column({ name: 'is_enabled', type: 'boolean', default: false })
  isEnabled: boolean;

  /** userId of whoever last toggled this flag */
  @Column({ name: 'enabled_by', type: 'uuid', nullable: true })
  enabledBy: string | null;

  /**
   * Super admin's entitlement. Defaults to true so orgs that predate
   * entitlement keep every feature they had.
   */
  @Column({ name: 'is_entitled', type: 'boolean', default: true })
  isEntitled: boolean;

  /** userId of the super admin who last changed the entitlement */
  @Column({ name: 'entitled_by', type: 'uuid', nullable: true })
  entitledBy: string | null;

  @Column({ name: 'entitled_at', type: 'timestamptz', nullable: true })
  entitledAt: Date | null;

  /** Trial expiry: from this moment on the feature is not entitled. */
  @Column({ name: 'entitled_until', type: 'timestamptz', nullable: true })
  entitledUntil: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
