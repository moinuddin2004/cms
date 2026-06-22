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
 * Per-organization toggle for a catalog feature.
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
