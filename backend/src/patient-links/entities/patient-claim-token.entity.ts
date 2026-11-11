import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Single-use QR claim token a staff member generates so a patient can link
 * their clinic record (M2-01, 03 §3 rule 7). Only the sha256 is stored.
 */
@Entity({ name: 'patient_claim_tokens' })
@Index('uq_patient_claim_tokens_token_hash', ['tokenHash'], { unique: true })
@Index('idx_patient_claim_tokens_org_patient', ['organizationId', 'patientId'])
export class PatientClaimToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** FK fk_patient_claim_tokens_organization_id → organizations(id) ON DELETE CASCADE. */
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /** FK fk_patient_claim_tokens_patient_id → patients(id) ON DELETE CASCADE. */
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ name: 'used_by_account_id', type: 'uuid', nullable: true })
  usedByAccountId: string | null;

  @Column({ name: 'invalidated_at', type: 'timestamptz', nullable: true })
  invalidatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
