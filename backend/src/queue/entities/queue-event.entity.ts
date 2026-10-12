import { Entity, PrimaryGeneratedColumn, Column, Unique, Index } from 'typeorm';
import { EntryStatus } from '../enums/queue.enums';

/**
 * Append-only audit log of every queue change, written in the same
 * transaction as the change. Corrections are new events, never updates.
 * `seq` comes from the session's `event_seq`, so clients can apply events in
 * order and detect gaps.
 */
@Entity({ name: 'queue_events' })
@Unique('uq_queue_event_session_seq', ['queueSessionId', 'seq'])
@Index(['organizationId', 'occurredAt'])
export class QueueEvent {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'queue_session_id', type: 'uuid' })
  queueSessionId: string;

  @Column({ name: 'queue_entry_id', type: 'uuid', nullable: true })
  queueEntryId: string | null;

  @Column({ name: 'seq', type: 'bigint' })
  seq: string;

  /** CHECKED_IN, CALLED, SKIPPED, MODE_CHANGED, … */
  @Column({ name: 'event_type', type: 'text' })
  eventType: string;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: EntryStatus,
    nullable: true,
  })
  fromStatus: EntryStatus | null;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: EntryStatus,
    nullable: true,
  })
  toStatus: EntryStatus | null;

  @Column({ name: 'reason_code', type: 'text', nullable: true })
  reasonCode: string | null;

  @Column({ name: 'reason_text', type: 'text', nullable: true })
  reasonText: string | null;

  /** On Select Patient: the entry the engine would have called. */
  @Column({ name: 'suggested_entry_id', type: 'uuid', nullable: true })
  suggestedEntryId: string | null;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ name: 'actor_role', type: 'text' })
  actorRole: string;

  @Column({ name: 'metadata', type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata: Record<string, unknown>;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt: Date;
}
