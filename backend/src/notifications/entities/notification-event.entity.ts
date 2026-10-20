import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { NotificationAudience } from '../notifications.enums';

/**
 * Platform catalog of everything that can notify someone (lab ERD §7).
 * Platform-level (no `organization_id`): seeded from code on boot,
 * insert-if-missing, so later sprints add events by adding seed entries.
 */
@Entity({ name: 'notification_events' })
export class NotificationEvent {
  /** e.g. `order.submitted`, `item.ready`. */
  @PrimaryColumn({ name: 'code', type: 'text' })
  code: string;

  @Column({ name: 'name', type: 'text' })
  name: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'audiences', type: 'text', array: true })
  audiences: NotificationAudience[];

  /** Internal audiences always get it in-app; clinics cannot switch it off. */
  @Column({ name: 'is_mandatory_internal', type: 'boolean', default: false })
  isMandatoryInternal: boolean;

  /** Placeholders the event supplies (besides the common ones). */
  @Column({ name: 'variables', type: 'text', array: true, default: '{}' })
  variables: string[];

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
