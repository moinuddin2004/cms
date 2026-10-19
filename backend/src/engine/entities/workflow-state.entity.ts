import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import {
  STATE_CATEGORIES,
  type StateCategory,
} from '../workflows/workflow.types';
import { WorkflowTemplateVersion } from './workflow-template-version.entity';

/** A state of a published workflow version (written once, at publish). */
@Entity({ name: 'workflow_states' })
@Unique('uq_workflow_states_code', ['templateVersionId', 'code'])
export class WorkflowState {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => WorkflowTemplateVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'template_version_id' })
  templateVersion: WorkflowTemplateVersion;

  @Column({ name: 'template_version_id', type: 'uuid' })
  templateVersionId: string;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'category', type: 'enum', enum: STATE_CATEGORIES })
  category: StateCategory;

  @Column({ name: 'is_terminal', type: 'boolean' })
  isTerminal: boolean;

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder: number;
}
