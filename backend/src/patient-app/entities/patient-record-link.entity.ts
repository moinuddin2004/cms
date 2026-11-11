import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PatientRecordLinkStatus = 'active' | 'frozen' | 'revoked';
export type PatientRecordLinkMethod = 'staff_qr';
export type PatientRecordLinkRevokedBy = 'patient' | 'clinic' | 'system';

/**
 * Consent-based link between an app profile and one clinic `patients` row
 * (M2-01). `uq_patient_record_links_active_patient`: a clinic patient has at
 * most one active link.
 */
@Entity({ name: 'patient_record_links' })
@Index('uq_patient_record_links_active_patient', ['patientId'], {
  unique: true,
  where: `"status" = 'active'`,
})
@Index('idx_patient_record_links_profile_id', ['profileId'])
@Index('idx_patient_record_links_org_patient', ['organizationId', 'patientId'])
@Check(
  'chk_patient_record_links_status',
  `"status" IN ('active', 'frozen', 'revoked')`,
)
@Check('chk_patient_record_links_method', `"link_method" IN ('staff_qr')`)
export class PatientRecordLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK fk_patient_record_links_profile_id → patient_profiles(id) ON DELETE CASCADE. */
  @Column({ name: 'profile_id', type: 'uuid' })
  profileId: string;

  /** FK fk_patient_record_links_organization_id → organizations(id) ON DELETE CASCADE. */
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /** FK fk_patient_record_links_patient_id → patients(id) ON DELETE CASCADE. */
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'status', type: 'varchar', length: 10, default: 'active' })
  status: PatientRecordLinkStatus;

  @Column({
    name: 'link_method',
    type: 'varchar',
    length: 20,
    default: 'staff_qr',
  })
  linkMethod: PatientRecordLinkMethod;

  @Column({ name: 'verified_by_user_id', type: 'uuid', nullable: true })
  verifiedByUserId: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({
    name: 'revoked_by_type',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  revokedByType: PatientRecordLinkRevokedBy | null;

  @Column({ name: 'revoked_by_id', type: 'uuid', nullable: true })
  revokedById: string | null;

  @Column({
    name: 'revoke_reason',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  revokeReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
