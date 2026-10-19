import {
  Check,
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
import { Specialty } from 'src/engine/entities/specialty.entity';
import { Lab } from 'src/labs/entities/lab.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import type { OrderTemplateBody } from '../templates/order-template.types';

/**
 * A saved order a doctor starts from ("my usual zirconia crown") so an
 * order takes seconds (lab ERD §13 "Doctor speed"). `owner_user_id` null =
 * shared with the whole clinic. The body references lab services and form
 * answers; it is validated on save, and again at order submit against the
 * form version current then.
 */
@Entity({ name: 'order_templates' })
@Check('chk_order_templates_use_count', `"use_count" >= 0`)
@Index('idx_order_templates_org_owner', [
  'organizationId',
  'ownerUserId',
  'isActive',
])
export class OrderTemplate {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /** Null = shared with every doctor of the clinic. */
  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @ManyToOne(() => Specialty, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'specialty_id' })
  specialty: Specialty;

  @Column({ name: 'specialty_id', type: 'uuid' })
  specialtyId: string;

  @ManyToOne(() => Lab, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_id' })
  lab: Lab | null;

  /** Null = the doctor picks the lab when ordering. */
  @Column({ name: 'lab_id', type: 'uuid', nullable: true })
  labId: string | null;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'template_json', type: 'jsonb' })
  templateJson: OrderTemplateBody;

  @Column({ name: 'use_count', type: 'int', default: 0 })
  useCount: number;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

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
