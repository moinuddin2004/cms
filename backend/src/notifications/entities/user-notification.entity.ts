import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { User } from 'src/user/entities/user.entity';
import { NotificationOutbox } from './notification-outbox.entity';

/**
 * A user's in-app copy of a sent `in_app` outbox row (the bell). One per
 * outbox row (unique), so a re-delivered send never shows twice.
 */
@Entity({ name: 'user_notifications' })
@Index('idx_user_notifications_user_created', ['userId', 'createdAt'])
@Index('idx_user_notifications_unread', ['userId'], {
  where: `"read_at" IS NULL`,
})
export class UserNotification {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'uuid' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => NotificationOutbox, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'outbox_id' })
  outbox: NotificationOutbox;

  @Column({ name: 'outbox_id', type: 'uuid', unique: true })
  outboxId: string;

  /** The clinic it came from, so a multi-clinic user can filter. */
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'event_code', type: 'text' })
  eventCode: string;

  @Column({ name: 'title', type: 'text' })
  title: string;

  @Column({ name: 'body', type: 'text' })
  body: string;

  @Column({ name: 'link', type: 'text', nullable: true })
  link: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
