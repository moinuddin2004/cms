import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Public visit-page token (M3-05): one random token → one queue entry. Only
 * its sha256 is stored; the clinic shares `/v/<token>`.
 */
@Entity({ name: 'queue_visit_tokens' })
@Index('uq_queue_visit_tokens_token_hash', ['tokenHash'], { unique: true })
@Index('idx_queue_visit_tokens_entry_id', ['entryId'])
@Index('idx_queue_visit_tokens_expires_at', ['expiresAt'])
export class QueueVisitToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'entry_id', type: 'uuid' })
  entryId: string;

  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
