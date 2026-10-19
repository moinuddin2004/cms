import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { WorkflowState } from './workflow-state.entity';
import { WorkflowTemplateVersion } from './workflow-template-version.entity';

/** An allowed move of a published workflow version (written once, at publish). */
@Entity({ name: 'workflow_transitions' })
@Unique('uq_workflow_transitions_move', [
  'templateVersionId',
  'fromStateId',
  'actionCode',
  'toStateId',
])
export class WorkflowTransition {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => WorkflowTemplateVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'template_version_id' })
  templateVersion: WorkflowTemplateVersion;

  @Column({ name: 'template_version_id', type: 'uuid' })
  templateVersionId: string;

  @ManyToOne(() => WorkflowState, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'from_state_id' })
  fromState: WorkflowState;

  @Column({ name: 'from_state_id', type: 'uuid' })
  fromStateId: string;

  @ManyToOne(() => WorkflowState, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'to_state_id' })
  toState: WorkflowState;

  @Column({ name: 'to_state_id', type: 'uuid' })
  toStateId: string;

  @Column({ name: 'action_code', type: 'varchar', length: 50 })
  actionCode: string;

  /** Empty = any role of an allowed side. */
  @Column({ name: 'allowed_roles', type: 'text', array: true, default: '{}' })
  allowedRoles: string[];

  @Column({ name: 'allowed_sides', type: 'text', array: true })
  allowedSides: string[];

  @Column({
    name: 'required_fields',
    type: 'jsonb',
    default: () => `'[]'::jsonb`,
  })
  requiredFields: string[];

  @Column({ name: 'requires_reason', type: 'boolean', default: false })
  requiresReason: boolean;
}
