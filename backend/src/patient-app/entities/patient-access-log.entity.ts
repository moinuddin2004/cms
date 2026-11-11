import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Who in the app looked at which clinic record (M2-01, 03 §3 rule 8).
 * No FKs on purpose: the log must survive account deletion. `id` is a
 * bigserial (TypeORM returns bigint as a string).
 */
@Entity({ name: 'patient_access_log' })
@Index('idx_patient_access_log_org_patient_at', [
  'organizationId',
  'patientId',
  'at',
])
@Index('idx_patient_access_log_account_at', ['accountId', 'at'])
export class PatientAccessLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'profile_id', type: 'uuid', nullable: true })
  profileId: string | null;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  /** view_list | view_detail | link | unlink | download */
  @Column({ name: 'action', type: 'varchar', length: 30 })
  action: string;

  /** prescription | visit | invoice | appointment | document | link */
  @Column({ name: 'resource_type', type: 'varchar', length: 30 })
  resourceType: string;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId: string | null;

  @Column({ name: 'at', type: 'timestamptz', default: () => 'now()' })
  at: Date;
}
