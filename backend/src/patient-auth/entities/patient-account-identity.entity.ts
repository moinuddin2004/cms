import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PatientIdentityProvider = 'google' | 'apple' | 'email';

/** One way an account can sign in (M2-01). `subject` = Google/Apple `sub` or lower(email). */
@Entity({ name: 'patient_account_identities' })
@Index(
  'uq_patient_account_identities_provider_subject',
  ['provider', 'subject'],
  { unique: true },
)
@Check(
  'chk_patient_account_identities_provider',
  `"provider" IN ('google', 'apple', 'email')`,
)
export class PatientAccountIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK fk_patient_account_identities_account_id → patient_accounts(id) ON DELETE CASCADE. */
  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'provider', type: 'varchar', length: 20 })
  provider: PatientIdentityProvider;

  @Column({ name: 'subject', type: 'varchar', length: 255 })
  subject: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
