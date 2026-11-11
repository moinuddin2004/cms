import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PatientAccountStatus = 'active' | 'disabled' | 'deleted';

/**
 * The patient's own login identity for the mobile patient space (M2-01).
 * Not org-scoped and unrelated to `users` / `patients.user_id`.
 * `uq_patient_accounts_email` is a partial unique index on `lower(email)`
 * declared in `database/schema`; it is mirrored here by name only.
 */
@Entity({ name: 'patient_accounts' })
@Index('uq_patient_accounts_email', { synchronize: false })
@Index('idx_patient_accounts_phone', ['phone'])
@Check(
  'chk_patient_accounts_status',
  `"status" IN ('active', 'disabled', 'deleted')`,
)
export class PatientAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150, nullable: true })
  fullName: string | null;

  @Column({ name: 'email', type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'phone_verified_at', type: 'timestamptz', nullable: true })
  phoneVerifiedAt: Date | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'active' })
  status: PatientAccountStatus;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
