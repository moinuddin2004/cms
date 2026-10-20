import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { Organization } from 'src/organizations/entities/organization.entity';
import {
  ALL_CHANNELS,
  ALL_LANGUAGES,
  NotificationChannel,
  NotificationLanguage,
} from '../notifications.enums';
import { NotificationEvent } from './notification-event.entity';
import { sqlList } from './sql-list';

/**
 * Wording of one event on one channel in one language. `organization_id`
 * null = platform default (seeded); a clinic's own row overrides it.
 */
@Entity({ name: 'notification_templates' })
@Index(
  'uq_notification_templates_platform',
  ['eventCode', 'channel', 'language'],
  { unique: true, where: `"organization_id" IS NULL` },
)
@Index(
  'uq_notification_templates_org',
  ['organizationId', 'eventCode', 'channel', 'language'],
  { unique: true, where: `"organization_id" IS NOT NULL` },
)
@Check(
  'chk_notification_templates_channel',
  `"channel" IN (${sqlList(ALL_CHANNELS)})`,
)
@Check(
  'chk_notification_templates_language',
  `"language" IN (${sqlList(ALL_LANGUAGES)})`,
)
export class NotificationTemplate {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @ManyToOne(() => NotificationEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'event_code' })
  event: NotificationEvent;

  @Column({ name: 'event_code', type: 'text' })
  eventCode: string;

  @Column({ name: 'channel', type: 'text' })
  channel: NotificationChannel;

  @Column({ name: 'language', type: 'text' })
  language: NotificationLanguage;

  /** In-app title / email subject; unused by WhatsApp and SMS. */
  @Column({ name: 'subject', type: 'text', nullable: true })
  subject: string | null;

  /** Text with `{placeholder}`s. */
  @Column({ name: 'body', type: 'text' })
  body: string;

  /** Placeholders the subject + body use (computed on save). */
  @Column({ name: 'variables', type: 'text', array: true, default: '{}' })
  variables: string[];

  /** WhatsApp: the provider-approved template id (business-initiated messages need one). */
  @Column({ name: 'provider_template_ref', type: 'text', nullable: true })
  providerTemplateRef: string | null;

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
