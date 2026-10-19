import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { Organization } from 'src/organizations/entities/organization.entity';
import {
  WORKFLOW_ENTITY_TYPES,
  type WorkflowEntityType,
} from '../workflows/workflow.types';
import { Specialty } from './specialty.entity';

/**
 * A workflow (state machine) for orders, items or stages. Content lives in
 * versions; every order/item/stage pins the version it started on.
 * `organization_id` null = platform default.
 */
@Entity({ name: 'workflow_templates' })
@Index('uq_workflow_templates_platform_code', ['specialtyId', 'code'], {
  unique: true,
  where: '"organization_id" IS NULL',
})
@Index(
  'uq_workflow_templates_org_code',
  ['organizationId', 'specialtyId', 'code'],
  { unique: true, where: '"organization_id" IS NOT NULL' },
)
export class WorkflowTemplate {
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

  @Column({ name: 'entity_type', type: 'enum', enum: WORKFLOW_ENTITY_TYPES })
  entityType: WorkflowEntityType;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

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
