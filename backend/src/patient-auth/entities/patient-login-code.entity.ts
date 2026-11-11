import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Emailed one-time sign-in code (M2-01). Stored hashed; 10 min, max 5 attempts (03 §3 rule 6). */
@Entity({ name: 'patient_login_codes' })
@Index('idx_patient_login_codes_email', { synchronize: false })
export class PatientLoginCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Lower-cased. */
  @Column({ name: 'email', type: 'varchar', length: 254 })
  email: string;

  /** sha256(code + pepper). */
  @Column({ name: 'code_hash', type: 'char', length: 64 })
  codeHash: string;

  @Column({ name: 'attempts', type: 'smallint', default: 0 })
  attempts: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
