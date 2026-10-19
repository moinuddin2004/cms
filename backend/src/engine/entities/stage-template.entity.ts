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
import { Organization } from 'src/organizations/entities/organization.entity';
import { Specialty } from './specialty.entity';

/**
 * The try-in rounds a piece of work goes through (PFM: metal → bisque →
 * final). Orders copy the step names into their own stage rows, so editing
 * a template never changes work already in progress.
 */
@Entity({ name: 'stage_templates' })
@Index('uq_stage_templates_platform_code', ['specialtyId', 'code'], {
  unique: true,
  where: '"organization_id" IS NULL',
})
@Index(
  'uq_stage_templates_org_code',
  ['organizationId', 'specialtyId', 'code'],
  {
    unique: true,
    where: '"organization_id" IS NOT NULL',
  },
)
export class StageTemplate {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => Specialty, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'specialty_id' })
  specialty: Specialty;

  @Column({ name: 'specialty_id', type: 'uuid' })
  specialtyId: string;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

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

@Entity({ name: 'stage_template_steps' })
@Unique('uq_stage_template_steps_seq', ['stageTemplateId', 'seq'])
@Unique('uq_stage_template_steps_code', ['stageTemplateId', 'code'])
@Check('chk_stage_template_steps_days', `"default_lab_days" BETWEEN 0 AND 365`)
@Check('chk_stage_template_steps_seq', `"seq" > 0`)
export class StageTemplateStep {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => StageTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stage_template_id' })
  stageTemplate: StageTemplate;

  @Column({ name: 'stage_template_id', type: 'uuid' })
  stageTemplateId: string;

  /** 1-based order. */
  @Column({ name: 'seq', type: 'int' })
  seq: number;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'requires_patient_visit', type: 'boolean', default: true })
  requiresPatientVisit: boolean;

  @Column({ name: 'requires_doctor_approval', type: 'boolean', default: true })
  requiresDoctorApproval: boolean;

  @Column({ name: 'default_lab_days', type: 'int', default: 3 })
  defaultLabDays: number;
}
