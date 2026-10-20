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
import {
  ALL_AUDIENCES,
  ALL_CHANNELS,
  NotificationAudience,
  NotificationChannel,
} from '../notifications.enums';
import { NotificationEvent } from './notification-event.entity';
import { NotificationTemplate } from './notification-template.entity';
import { sqlList } from './sql-list';

/**
 * Per clinic: is this event sent to this audience on this channel? Rows are
 * created lazily on first change; a missing row means `defaultRuleEnabled`.
 */
@Entity({ name: 'notification_rules' })
@Unique('uq_notification_rules_org_event_audience_channel', [
  'organizationId',
  'eventCode',
  'audience',
  'channel',
])
@Check(
  'chk_notification_rules_audience',
  `"audience" IN (${sqlList(ALL_AUDIENCES)})`,
)
@Check(
  'chk_notification_rules_channel',
  `"channel" IN (${sqlList(ALL_CHANNELS)})`,
)
export class NotificationRule {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => NotificationEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'event_code' })
  event: NotificationEvent;

  @Column({ name: 'event_code', type: 'text' })
  eventCode: string;

  @Column({ name: 'audience', type: 'text' })
  audience: NotificationAudience;

  @Column({ name: 'channel', type: 'text' })
  channel: NotificationChannel;

  @Column({ name: 'is_enabled', type: 'boolean' })
  isEnabled: boolean;

  /** Pins one template; null = resolve by event, channel and the recipient's language. */
  @ManyToOne(() => NotificationTemplate, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'template_id' })
  template: NotificationTemplate | null;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId: string | null;

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
