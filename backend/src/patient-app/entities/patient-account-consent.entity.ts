import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type PatientConsentKind =
  | 'terms'
  | 'privacy'
  | 'link'
  | 'whatsapp_opt_in';

/** Versioned consent the account accepted (M2-01). `organization_id` is set for kind `link`. */
@Entity({ name: 'patient_account_consents' })
@Index('idx_patient_account_consents_account_kind', ['accountId', 'kind'])
@Check(
  'chk_patient_account_consents_kind',
  `"kind" IN ('terms', 'privacy', 'link', 'whatsapp_opt_in')`,
)
export class PatientAccountConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK fk_patient_account_consents_account_id → patient_accounts(id) ON DELETE CASCADE. */
  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'kind', type: 'varchar', length: 20 })
  kind: PatientConsentKind;

  @Column({ name: 'version', type: 'varchar', length: 20 })
  version: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({
    name: 'accepted_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  acceptedAt: Date;

  @Column({ name: 'ip', type: 'varchar', length: 64, nullable: true })
  ip: string | null;
}
