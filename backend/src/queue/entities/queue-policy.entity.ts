import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
  Check,
} from 'typeorm';
import { RejoinPolicy } from '../enums/queue.enums';

/**
 * Queue settings. A row with `location_id = NULL` is the organization default;
 * a row with a location overrides it for that location. The timezone is not
 * stored here — it is the location's own `locations.timezone`.
 */
@Entity({ name: 'queue_policies' })
// One org default + at most one override per location (two partial indexes
// stand in for UNIQUE NULLS NOT DISTINCT, which TypeORM 0.3 can't declare).
@Index('uq_queue_policy_org_default', ['organizationId'], {
  unique: true,
  where: '"location_id" IS NULL',
})
@Index('uq_queue_policy_location', ['organizationId', 'locationId'], {
  unique: true,
  where: '"location_id" IS NOT NULL',
})
@Check(`"early_window_min" BETWEEN 0 AND 240`)
@Check(`"late_grace_min" >= 0`)
@Check(`"walkin_starvation_min" > 0`)
@Check(`"call_timeout_sec" IS NULL OR "call_timeout_sec" >= 30`)
@Check(`"max_late_min" >= "late_grace_min"`)
export class QueuePolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /** NULL = organization default. */
  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId: string | null;

  @Column({ name: 'smart_queue_enabled', type: 'boolean', default: false })
  smartQueueEnabled: boolean;

  @Column({ name: 'early_window_min', type: 'int', default: 15 })
  earlyWindowMin: number;

  @Column({ name: 'late_grace_min', type: 'int', default: 10 })
  lateGraceMin: number;

  @Column({ name: 'max_late_min', type: 'int', default: 45 })
  maxLateMin: number;

  @Column({ name: 'walkin_starvation_min', type: 'int', default: 45 })
  walkinStarvationMin: number;

  @Column({
    name: 'skipped_rejoin_policy',
    type: 'enum',
    enum: RejoinPolicy,
    default: RejoinPolicy.END,
  })
  skippedRejoinPolicy: RejoinPolicy;

  /** NULL = auto-skip after a call is off. */
  @Column({ name: 'call_timeout_sec', type: 'int', nullable: true })
  callTimeoutSec: number | null;

  @Column({
    name: 'manual_select_reason_required',
    type: 'boolean',
    default: false,
  })
  manualSelectReasonRequired: boolean;

  /** Local time a service day starts, e.g. "04:00" for a night-shift clinic. */
  @Column({ name: 'service_day_cutoff', type: 'time', default: '00:00' })
  serviceDayCutoff: string;

  @Column({ name: 'version', type: 'int', default: 0 })
  version: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
