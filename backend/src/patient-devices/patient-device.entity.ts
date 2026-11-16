import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PatientDevicePlatform = 'android' | 'ios';

/**
 * One phone that receives a patient ACCOUNT's push messages (M3-07). Same
 * shape as `user_devices`; `uq_patient_devices_token` means a re-registered
 * token moves to the newest account (shared phone, 07 §4.2).
 * FK `fk_patient_devices_account_id` → patient_accounts(id) ON DELETE CASCADE
 * is declared in `database/schema`.
 */
@Entity({ name: 'patient_devices' })
@Index('uq_patient_devices_token', ['expoPushToken'], { unique: true })
@Index('idx_patient_devices_account_id', ['accountId'])
@Check('chk_patient_devices_platform', `"platform" IN ('android', 'ios')`)
export class PatientDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'expo_push_token', type: 'varchar', length: 200 })
  expoPushToken: string;

  @Column({ name: 'platform', type: 'varchar', length: 10 })
  platform: PatientDevicePlatform;

  @Column({ name: 'device_label', type: 'varchar', length: 80, nullable: true })
  deviceLabel: string | null;

  @Column({ name: 'app_version', type: 'varchar', length: 20, nullable: true })
  appVersion: string | null;

  @Column({
    name: 'last_seen_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  lastSeenAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
