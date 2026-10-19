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
import { FormSchema } from 'src/engine/entities/form-schema.entity';
import { Specialty } from 'src/engine/entities/specialty.entity';
import { StageTemplate } from 'src/engine/entities/stage-template.entity';
import { WorkflowTemplate } from 'src/engine/entities/workflow-template.entity';
import { Lab } from 'src/labs/entities/lab.entity';
import { UnitType } from '../enums/catalog.enums';
import { ServiceCategory } from './service-category.entity';

/**
 * Something a lab makes (zirconia crown, PFM bridge unit …). Platform-level
 * like the lab itself — no tenant column; clinics see it through their lab
 * link. Points at the engine definitions an order line runs on: the form
 * the doctor fills, the item workflow and the try-in stage template. Those
 * are platform definitions referenced by identity; an order pins the
 * version that is current when it is submitted.
 */
@Entity({ name: 'lab_services' })
@Unique('uq_lab_services_lab_code', ['labId', 'code'])
@Check(
  'chk_lab_services_turnaround',
  `"default_turnaround_days" BETWEEN 0 AND 365`,
)
@Index('idx_lab_services_lab_active', ['labId', 'isActive', 'name'])
@Index('idx_lab_services_category', ['categoryId'])
export class LabService {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => Lab, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_id' })
  lab: Lab;

  @Column({ name: 'lab_id', type: 'uuid' })
  labId: string;

  @ManyToOne(() => Specialty, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'specialty_id' })
  specialty: Specialty;

  @Column({ name: 'specialty_id', type: 'uuid' })
  specialtyId: string;

  @ManyToOne(() => ServiceCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: ServiceCategory;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  /** Upper-case, unique per lab: `ZR_CROWN`. */
  @Column({ name: 'code', type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'unit_type', type: 'enum', enum: UnitType })
  unitType: UnitType;

  @Column({ name: 'default_turnaround_days', type: 'int', default: 7 })
  defaultTurnaroundDays: number;

  @ManyToOne(() => FormSchema, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'form_schema_id' })
  formSchema: FormSchema | null;

  @Column({ name: 'form_schema_id', type: 'uuid', nullable: true })
  formSchemaId: string | null;

  @ManyToOne(() => WorkflowTemplate, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workflow_template_id' })
  workflowTemplate: WorkflowTemplate | null;

  @Column({ name: 'workflow_template_id', type: 'uuid', nullable: true })
  workflowTemplateId: string | null;

  @ManyToOne(() => StageTemplate, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stage_template_id' })
  stageTemplate: StageTemplate | null;

  @Column({ name: 'stage_template_id', type: 'uuid', nullable: true })
  stageTemplateId: string | null;

  /** Archived services are hidden from new orders; old orders keep them. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

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
