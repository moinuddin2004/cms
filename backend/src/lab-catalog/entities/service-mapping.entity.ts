import {
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
import { CatalogService } from 'src/billing/entities/catalog-service.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { LabService } from './lab-service.entity';

/**
 * Which lab service fulfils which of the clinic's treatments. The clinic
 * treatment is the billing catalog's `services` row — the clinic's patient
 * price list already lives there (Sprint 5 deviation, see hand-over); the
 * column keeps the ERD name. A treatment may be made by several labs (one
 * is the default); a lab service is billed as exactly one treatment per
 * clinic, so an order line's patient price is never ambiguous.
 */
@Entity({ name: 'service_mappings' })
@Unique('uq_service_mappings_pair', [
  'organizationId',
  'clinicTreatmentId',
  'labServiceId',
])
@Index('uq_service_mappings_lab_service', ['organizationId', 'labServiceId'], {
  unique: true,
  where: '"is_active"',
})
@Index('uq_service_mappings_default', ['organizationId', 'clinicTreatmentId'], {
  unique: true,
  where: '"is_active" AND "is_default"',
})
export class ServiceMapping {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => CatalogService, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'clinic_treatment_id' })
  clinicTreatment: CatalogService;

  /** `services.id` — the clinic's billable treatment. */
  @Column({ name: 'clinic_treatment_id', type: 'uuid' })
  clinicTreatmentId: string;

  @ManyToOne(() => LabService, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_service_id' })
  labService: LabService;

  @Column({ name: 'lab_service_id', type: 'uuid' })
  labServiceId: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

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
