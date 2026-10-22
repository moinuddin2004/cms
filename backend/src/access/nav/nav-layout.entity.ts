import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from 'src/organizations/entities/organization.entity';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import type { NavLayoutJson } from './nav-layout.types';

/**
 * A clinic's sidebar arrangement (design doc "Sidebar customization"): which
 * nav keys go in which section, renames, hidden keys. It only arranges keys
 * the web app's registry defines — it never grants access.
 *
 * `role_id` NULL = the clinic default (the only kind v1 writes). Postgres
 * treats NULLs as distinct, so the clinic default gets its own partial
 * unique index next to unique(org, role).
 */
@Entity({ name: 'nav_layouts' })
@Index('uq_nav_layouts_org_role', ['organizationId', 'roleId'], {
  unique: true,
})
@Index('uq_nav_layouts_org_default', ['organizationId'], {
  unique: true,
  where: '"role_id" IS NULL',
})
export class NavLayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => EmploymentRole, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'role_id' })
  role: EmploymentRole | null;

  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId: string | null;

  @Column({ name: 'layout', type: 'jsonb' })
  layout: NavLayoutJson;

  /** +1 on every save. */
  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
