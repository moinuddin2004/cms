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
import { Location } from 'src/locations/entities/location.entity';

/**
 * Owner's per-location narrowing of an org feature: `is_disabled = true`
 * turns an org-active feature OFF at one location. It can never turn a
 * feature ON beyond the org setting (there is no "force on").
 */
@Entity({ name: 'location_feature_overrides' })
@Unique(['locationId', 'featureKey'])
@Index(['organizationId', 'locationId'])
export class LocationFeatureOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Denormalized from the location, for tenant-scoped reads. */
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  /** Denormalized from feature_catalog.key */
  @Column({ name: 'feature_key', type: 'varchar', length: 100 })
  featureKey: string;

  @Column({ name: 'is_disabled', type: 'boolean', default: false })
  isDisabled: boolean;

  /** userId of whoever last changed this override */
  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
