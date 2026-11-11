import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PatientProfileRelation =
  | 'self'
  | 'child'
  | 'parent'
  | 'spouse'
  | 'other';
export type PatientProfileGender = 'male' | 'female' | 'other';

/**
 * A person an account manages: the owner (`self`) or a family member (M2-01).
 * Record links hang off profiles, never off accounts.
 */
@Entity({ name: 'patient_profiles' })
@Index('idx_patient_profiles_account_id', ['accountId'])
@Index('uq_patient_profiles_self', ['accountId'], {
  unique: true,
  where: `"relation" = 'self'`,
})
@Check(
  'chk_patient_profiles_relation',
  `"relation" IN ('self', 'child', 'parent', 'spouse', 'other')`,
)
@Check(
  'chk_patient_profiles_gender',
  `"gender" IS NULL OR "gender" IN ('male', 'female', 'other')`,
)
export class PatientProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK fk_patient_profiles_account_id → patient_accounts(id) ON DELETE CASCADE. */
  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'relation', type: 'varchar', length: 10 })
  relation: PatientProfileRelation;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({ name: 'dob', type: 'date', nullable: true })
  dob: string | null;

  @Column({ name: 'gender', type: 'varchar', length: 10, nullable: true })
  gender: PatientProfileGender | null;

  @Column({ name: 'private_reminders', type: 'boolean', default: false })
  privateReminders: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
