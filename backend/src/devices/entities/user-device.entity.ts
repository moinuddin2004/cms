import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type DevicePlatform = 'android' | 'ios';

/**
 * One phone that should receive a signed-in clinic user's push messages
 * (M1-04). Deliberately **not** org-scoped: the same device gets that user's
 * alerts whichever clinic they are working at, and `uq_user_devices_token`
 * means a re-registered token moves to the newest user (07 §4.2).
 * `platform` matches `chk_user_devices_platform` in `database/schema`.
 */
@Entity({ name: 'user_devices' })
@Index('uq_user_devices_token', ['expoPushToken'], { unique: true })
@Index('idx_user_devices_user_id', ['userId'])
@Check('chk_user_devices_platform', `"platform" IN ('android', 'ios')`)
export class UserDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** `users.uuid` — the signed-in user who last registered this token. */
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Expo push token (`ExponentPushToken[…]`). Unique: one row per phone. */
  @Column({ name: 'expo_push_token', type: 'varchar', length: 200 })
  expoPushToken: string;

  @Column({ name: 'platform', type: 'varchar', length: 10 })
  platform: DevicePlatform;

  @Column({ name: 'device_label', type: 'varchar', length: 80, nullable: true })
  deviceLabel: string | null;

  @Column({ name: 'app_version', type: 'varchar', length: 20, nullable: true })
  appVersion: string | null;

  /** Bumped on every registration, so dead devices can be spotted later. */
  @Column({
    name: 'last_seen_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  lastSeenAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
