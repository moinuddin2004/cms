import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { Organization } from 'src/organizations/entities/organization.entity';
import { ALL_AUDIENCES, NotificationAudience } from '../notifications.enums';
import { sqlList } from './sql-list';

/**
 * Per-clinic master switch and quiet hours for one audience. Rows are
 * created lazily on first change; a missing row means the defaults in
 * `defaultAudienceEnabled` (patient OFF).
 */
@Entity({ name: 'notification_audience_settings' })
@Unique('uq_notification_audience_settings_org_audience', [
  'organizationId',
  'audience',
])
@Check(
  'chk_notification_audience_settings_audience',
  `"audience" IN (${sqlList(ALL_AUDIENCES)})`,
)
@Check(
  'chk_notification_audience_settings_quiet',
  `("quiet_start" IS NULL) = ("quiet_end" IS NULL)`,
)
export class NotificationAudienceSetting {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'audience', type: 'text' })
  audience: NotificationAudience;

  @Column({ name: 'is_enabled', type: 'boolean' })
  isEnabled: boolean;

  /** Local wall-clock "HH:MM[:SS]"; may wrap midnight (22:00 → 08:00). */
  @Column({ name: 'quiet_start', type: 'time', nullable: true })
  quietStart: string | null;

  @Column({ name: 'quiet_end', type: 'time', nullable: true })
  quietEnd: string | null;

  /** IANA zone for quiet hours; null = the location's timezone. */
  @Column({ name: 'timezone', type: 'text', nullable: true })
  timezone: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}
