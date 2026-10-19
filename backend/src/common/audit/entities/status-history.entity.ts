import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { ActorSide, TransitionVia } from '../audit.enums';

/**
 * Append-only log of every status change (lab ERD §7): from → to, the
 * action, who did it, from which side and through which channel. States are
 * free text because workflow states are data (engine templates), not enums.
 * UPDATE and DELETE are rejected by a trigger.
 */
@Entity({ name: 'status_history' })
@Index('idx_status_history_entity', ['entityType', 'entityId', 'createdAt'])
export class StatusHistory {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 50 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  /** Null for the creating transition. */
  @Column({ name: 'from_state', type: 'varchar', length: 50, nullable: true })
  fromState: string | null;

  @Column({ name: 'to_state', type: 'varchar', length: 50 })
  toState: string;

  @Column({ name: 'action_code', type: 'varchar', length: 50 })
  actionCode: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ name: 'actor_side', type: 'enum', enum: ActorSide })
  actorSide: ActorSide;

  @Column({
    name: 'via',
    type: 'enum',
    enum: TransitionVia,
    default: TransitionVia.APP,
  })
  via: TransitionVia;

  /** Set when clinic staff updated on the lab's behalf (`via = proxy`). */
  @Column({ name: 'on_behalf_of_lab_id', type: 'uuid', nullable: true })
  onBehalfOfLabId: string | null;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
