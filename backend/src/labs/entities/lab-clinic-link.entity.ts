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
import { LabLinkStatus, PatientDataLevel } from '../enums/lab.enums';
import { Lab } from './lab.entity';

/**
 * A clinic organization working with a lab: its own status, payment terms
 * and how much patient identity the lab may see. Tenant-owned — every read
 * is scoped by `organization_id`. Status changes go through
 * `LabLinksService` only and land in `status_history`.
 */
@Entity({ name: 'lab_clinic_links' })
@Unique('uq_lab_clinic_links_lab_org', ['labId', 'organizationId'])
@Check('chk_lab_clinic_links_terms', `"payment_terms_days" BETWEEN 0 AND 365`)
@Index('idx_lab_clinic_links_org_status', ['organizationId', 'status'])
export class LabClinicLink {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => Lab, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_id' })
  lab: Lab;

  @Column({ name: 'lab_id', type: 'uuid' })
  labId: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: LabLinkStatus,
    default: LabLinkStatus.INVITED,
  })
  status: LabLinkStatus;

  @Column({ name: 'payment_terms_days', type: 'int', default: 30 })
  paymentTermsDays: number;

  @Column({
    name: 'patient_data_level',
    type: 'enum',
    enum: PatientDataLevel,
    default: PatientDataLevel.FULL_NAME,
  })
  patientDataLevel: PatientDataLevel;

  /** First activation; kept when the link is later suspended and reactivated. */
  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

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
