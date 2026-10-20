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
import { StageTemplateStep } from 'src/engine/entities/stage-template.entity';
import { WorkflowTemplateVersion } from 'src/engine/entities/workflow-template-version.entity';
import { LabOrderItem } from 'src/lab-orders/entities/lab-order-item.entity';
import { LabOrder } from 'src/lab-orders/entities/lab-order.entity';
import { StageOutcome } from '../enums/production.enums';

/**
 * One try-in round of one stage of an item (lab ERD §5b, §9b): "Metal
 * try-in, round 2". Created from the item's stage template at lab accept
 * (`init_stages`, round 1). A correction closes the round and adds a new
 * row with `round_no + 1` — rounds are never overwritten.
 *
 * Inv. 9: one active stage per item — `is_active` (state category active /
 * waiting, set with every state change) carries a partial unique index.
 */
@Entity({ name: 'order_item_stages' })
@Unique('uq_order_item_stages_round', ['itemId', 'seq', 'roundNo'])
@Index('uq_order_item_stages_one_active', ['itemId'], {
  unique: true,
  where: '"is_active"',
})
@Index('idx_order_item_stages_order', ['orderId'])
@Index('idx_order_item_stages_lab_status', ['labId', 'statusCode'])
@Check('chk_order_item_stages_round', `"round_no" > 0 AND "seq" > 0`)
export class OrderItemStage {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /** The order's lab — lab portal reads filter on it. */
  @Column({ name: 'lab_id', type: 'uuid' })
  labId: string;

  @ManyToOne(() => LabOrder, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: LabOrder;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @ManyToOne(() => LabOrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: LabOrderItem;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @ManyToOne(() => StageTemplateStep, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stage_template_step_id' })
  stageTemplateStep: StageTemplateStep | null;

  @Column({ name: 'stage_template_step_id', type: 'uuid', nullable: true })
  stageTemplateStepId: string | null;

  /** The stage workflow version this round follows (pinned, inv. 7). */
  @ManyToOne(() => WorkflowTemplateVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workflow_template_version_id' })
  workflowTemplateVersion: WorkflowTemplateVersion;

  @Column({ name: 'workflow_template_version_id', type: 'uuid' })
  workflowTemplateVersionId: string;

  @Column({ name: 'seq', type: 'int' })
  seq: number;

  @Column({ name: 'round_no', type: 'int', default: 1 })
  roundNo: number;

  @Column({ name: 'code_snap', type: 'varchar', length: 50 })
  codeSnap: string;

  @Column({ name: 'name_snap', type: 'varchar', length: 100 })
  nameSnap: string;

  /** The last stage: finished work (QC → ready → dispatch), not a try-in. */
  @Column({ name: 'is_final', type: 'boolean', default: false })
  isFinal: boolean;

  @Column({ name: 'requires_patient_visit', type: 'boolean', default: true })
  requiresPatientVisit: boolean;

  @Column({ name: 'status_code', type: 'varchar', length: 50 })
  statusCode: string;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ name: 'lab_expected_on', type: 'date', nullable: true })
  labExpectedOn: string | null;

  /** The try-in appointment (optional link). */
  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({
    name: 'outcome',
    type: 'enum',
    enum: StageOutcome,
    nullable: true,
  })
  outcome: StageOutcome | null;

  @Column({ name: 'tryin_notes', type: 'text', nullable: true })
  tryinNotes: string | null;

  @Column({ name: 'correction_notes', type: 'text', nullable: true })
  correctionNotes: string | null;

  @Column({ name: 'decided_by', type: 'uuid', nullable: true })
  decidedBy: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}
