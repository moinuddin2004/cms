import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A shareable "join this clinic" link (`/join/<token>`) an owner/manager
 * sends staff, e.g. on WhatsApp. Opening it lets someone sign in with Google
 * and send a join request; it grants no access by itself — the request is
 * approved under Employees, where the role is chosen.
 */
@Entity({ name: 'clinic_invites' })
@Index(['token'], { unique: true })
@Index(['organizationId'])
export class ClinicInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /** Random URL-safe token; it only lets people *ask* to join. */
  @Column({ name: 'token', type: 'varchar', length: 64 })
  token: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /** Join requests sent through this link. */
  @Column({ name: 'uses', type: 'int', default: 0 })
  uses: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
