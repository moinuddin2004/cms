import {
  Check,
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/** What the platform decided for one clinic's event × channel. */
export type PlatformOverrideMode = 'on' | 'off';

/**
 * Super admin override of a clinic's choice for a mandatory event's email
 * (notifications + email plan): `on` = always emailed (the owner can't switch
 * it off), `off` = never emailed. No row = the clinic decides (its rule /
 * the default). Mandatory in-app stays always on regardless.
 */
@Entity({ name: 'notification_platform_overrides' })
@Check('chk_notification_platform_overrides_mode', `"mode" IN ('on', 'off')`)
export class NotificationPlatformOverride {
  @PrimaryColumn({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @PrimaryColumn({ name: 'event_code', type: 'text' })
  eventCode: string;

  @PrimaryColumn({ name: 'channel', type: 'text' })
  channel: string;

  @Column({ name: 'mode', type: 'text' })
  mode: PlatformOverrideMode;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
