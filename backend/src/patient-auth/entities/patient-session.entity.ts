import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A signed-in phone of a patient account (M2-01). Only sha256 hashes of the
 * opaque refresh tokens are stored (03 §3 rule 5).
 */
@Entity({ name: 'patient_sessions' })
@Index('idx_patient_sessions_account_id', ['accountId'])
@Index('uq_patient_sessions_refresh_token_hash', ['refreshTokenHash'], {
  unique: true,
})
export class PatientSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK fk_patient_sessions_account_id → patient_accounts(id) ON DELETE CASCADE. */
  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  /** sha256 hex of the current refresh token. */
  @Column({ name: 'refresh_token_hash', type: 'char', length: 64 })
  refreshTokenHash: string;

  /** Last rotated token: presenting it again revokes the session. */
  @Column({
    name: 'previous_token_hash',
    type: 'char',
    length: 64,
    nullable: true,
  })
  previousTokenHash: string | null;

  @Column({ name: 'device_label', type: 'varchar', length: 80, nullable: true })
  deviceLabel: string | null;

  @Column({ name: 'ip', type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  /** 60 days sliding. */
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({
    name: 'last_used_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  lastUsedAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
