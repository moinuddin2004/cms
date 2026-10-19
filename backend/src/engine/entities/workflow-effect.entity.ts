import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { WorkflowTransition } from './workflow-transition.entity';

/**
 * Registry of effect handlers that exist in code (lab ERD §3). Synced from
 * the in-memory registry on boot; configuration can only pick from these,
 * never run new code.
 */
@Entity({ name: 'workflow_effects' })
export class WorkflowEffect {
  @PrimaryColumn({ name: 'code', type: 'varchar', length: 60 })
  code: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  /** Financial effects validate themselves in code; config cannot skip that. */
  @Column({ name: 'is_financial', type: 'boolean', default: false })
  isFinancial: boolean;

  /** False when the handler was removed from code (kept for old versions). */
  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/** An effect a transition runs, in `seq` order, inside its transaction. */
@Entity({ name: 'transition_effects' })
@Unique('uq_transition_effects_seq', ['transitionId', 'seq'])
export class TransitionEffect {
  @PrimaryColumn({ name: 'transition_id', type: 'uuid' })
  transitionId: string;

  @PrimaryColumn({ name: 'effect_code', type: 'varchar', length: 60 })
  effectCode: string;

  @ManyToOne(() => WorkflowTransition, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'transition_id' })
  transition: WorkflowTransition;

  @ManyToOne(() => WorkflowEffect, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'effect_code' })
  effect: WorkflowEffect;

  @Column({ name: 'seq', type: 'int' })
  seq: number;

  @Column({ name: 'params', type: 'jsonb', nullable: true })
  params: Record<string, unknown> | null;
}
