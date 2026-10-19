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
import { Specialty } from './specialty.entity';

/**
 * A form (CROWN, BRIDGE …) — the stable identity; its content lives in
 * versions. `organization_id` null = platform default; an organization's own
 * schema with the same code overrides the default for that organization.
 */
@Entity({ name: 'form_schemas' })
@Index('uq_form_schemas_platform_code', ['specialtyId', 'code'], {
  unique: true,
  where: '"organization_id" IS NULL',
})
@Index('uq_form_schemas_org_code', ['organizationId', 'specialtyId', 'code'], {
  unique: true,
  where: '"organization_id" IS NOT NULL',
})
export class FormSchema {
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

  /** Upper-case, stable: `CROWN`. Lab services point at forms by id. */
  @Column({ name: 'code', type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  /** Archived forms are not offered for new services; pinned orders keep working. */
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
