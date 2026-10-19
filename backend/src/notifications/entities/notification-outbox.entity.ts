import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { Organization } from 'src/organizations/entities/organization.entity';
import {
  ALL_AUDIENCES,
  ALL_CHANNELS,
  ALL_OUTBOX_STATUSES,
  NotificationAudience,
  NotificationChannel,
  NotificationLanguage,
  OutboxStatus,
  RecipientType,
} from '../notifications.enums';
import { NotificationEvent } from './notification-event.entity';
import { sqlList } from './sql-list';

/** What the worker sends — rendered at enqueue, so the log shows the exact text. */
export interface NotificationPayload {
  title: string | null;
  body: string;
  link: string | null;
  language: NotificationLanguage;
  /** Phone or email for external channels; null for in-app. */
  to: string | null;
  recipientName: string | null;
  providerTemplateRef: string | null;
  variables: Record<string, string>;
  /** Why the decision order chose this status (e.g. `audience_disabled`). */
  reason: string;
}

/**
 * One message to one recipient on one channel (lab ERD §7). Written in the
 * same transaction as the change that caused it — skipped ones too, so the
 * log says why a message never went — and sent by the worker only after
 * commit. Never deleted; after insert only the worker touches it, and only
 * the delivery columns (status, attempts, scheduled_for, provider_message_id,
 * last_error, sent_at).
 */
@Entity({ name: 'notification_outbox' })
@Index('idx_notification_outbox_pending', ['status', 'scheduledFor'], {
  where: `"status" IN ('queued', 'held_quiet_hours')`,
})
@Index('idx_notification_outbox_org_created', ['organizationId', 'createdAt'])
@Index('idx_notification_outbox_entity', ['entityType', 'entityId'])
@Check(
  'chk_notification_outbox_status',
  `"status" IN (${sqlList(ALL_OUTBOX_STATUSES)})`,
)
@Check(
  'chk_notification_outbox_audience',
  `"audience" IN (${sqlList(ALL_AUDIENCES)})`,
)
@Check(
  'chk_notification_outbox_channel',
  `"channel" IN (${sqlList(ALL_CHANNELS)})`,
)
export class NotificationOutbox {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId: string | null;

  @ManyToOne(() => NotificationEvent, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'event_code' })
  event: NotificationEvent;

  @Column({ name: 'event_code', type: 'text' })
  eventCode: string;

  @Column({ name: 'audience', type: 'text' })
  audience: NotificationAudience;

  @Column({ name: 'recipient_type', type: 'text' })
  recipientType: RecipientType;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string;

  @Column({ name: 'channel', type: 'text' })
  channel: NotificationChannel;

  /** What caused it (an order, an item …), for "messages about this order". */
  @Column({ name: 'entity_type', type: 'text', nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ name: 'payload', type: 'jsonb' })
  payload: NotificationPayload;

  @Column({ name: 'status', type: 'text' })
  status: OutboxStatus;

  /** Not before this; also the worker's lease while a send is in flight. */
  @Column({
    name: 'scheduled_for',
    type: 'timestamptz',
    default: () => 'now()',
  })
  scheduledFor: Date;

  @Column({ name: 'attempts', type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'provider_message_id', type: 'text', nullable: true })
  providerMessageId: string | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
