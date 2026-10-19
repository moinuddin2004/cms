import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { DefinitionStatus } from '../enums/engine.enums';
import type { WorkflowDefinition } from '../workflows/workflow.types';
import { WorkflowTemplate } from './workflow-template.entity';

/**
 * One version of a workflow. A draft's definition is edited as JSON
 * (`definition_json`); publishing checks it and materialises it into
 * `workflow_states`, `workflow_transitions` and `transition_effects`, which
 * the runtime reads. Published versions never change (service-enforced).
 */
@Entity({ name: 'workflow_template_versions' })
@Unique('uq_workflow_template_versions_no', ['workflowTemplateId', 'versionNo'])
@Index('uq_workflow_template_versions_one_draft', ['workflowTemplateId'], {
  unique: true,
  where: `"status" = 'draft'`,
})
@Index('uq_workflow_template_versions_one_published', ['workflowTemplateId'], {
  unique: true,
  where: `"status" = 'published'`,
})
@Check('chk_workflow_template_versions_no', `"version_no" > 0`)
export class WorkflowTemplateVersion {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => WorkflowTemplate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workflow_template_id' })
  workflowTemplate: WorkflowTemplate;

  @Column({ name: 'workflow_template_id', type: 'uuid' })
  workflowTemplateId: string;

  @Column({ name: 'version_no', type: 'int' })
  versionNo: number;

  /** Snapshot of the definition (the draft's working copy). */
  @Column({ name: 'definition_json', type: 'jsonb' })
  definitionJson: WorkflowDefinition;

  @Column({
    name: 'status',
    type: 'enum',
    enum: DefinitionStatus,
    default: DefinitionStatus.DRAFT,
  })
  status: DefinitionStatus;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy: string | null;

  @Column({ name: 'retired_at', type: 'timestamptz', nullable: true })
  retiredAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}
