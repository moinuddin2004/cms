import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Organization } from 'src/organizations/entities/organization.entity';
import type { Grant } from 'src/access/catalog/permissions';

@Entity({ name: 'employment_roles' })
@Unique(['organizationId', 'slug'])
@Index(['organizationId', 'isActive'])
export class EmploymentRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'slug', type: 'varchar', length: 100 })
  slug: string;

  /**
   * `{ [permission]: 'own' | 'location' | 'org' | true }` — granted only; a
   * missing key is no access (see src/access/catalog/permissions.ts). Old
   * rows may still hold legacy booleans (`canManageSettings`…), which the
   * resolver ignores.
   */
  @Column({ name: 'permissions', type: 'jsonb', default: '{}' })
  permissions: Record<string, Grant | false>;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  /** System template this role was seeded from (`doctor`, `receptionist`…). */
  @Column({ name: 'template_key', type: 'varchar', length: 50, nullable: true })
  templateKey: string | null;

  /** Where members land after login, e.g. `/queue/doctor`. */
  @Column({ name: 'home_route', type: 'varchar', length: 255, nullable: true })
  homeRoute: string | null;

  @Column({ name: 'is_system_role', type: 'boolean', default: true })
  isSystemRole: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
