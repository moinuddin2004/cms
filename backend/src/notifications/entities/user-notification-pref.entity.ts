import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/user/entities/user.entity';

/**
 * One personal notification switch of a user, keyed by name so new switches
 * need no schema change: `sound` today; per-event email switches later
 * (`email:<event_code>`). A missing row means the switch's default.
 */
@Entity({ name: 'user_notification_prefs' })
export class UserNotificationPref {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'key', type: 'text' })
  key: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'uuid' })
  user: User;

  @Column({ name: 'enabled', type: 'boolean' })
  enabled: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
