import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';

/**
 * Account emails sent outside the notification outbox (verify, password
 * reset, security notices, lab address confirmation) — so a failed send is
 * visible and counts toward the daily cap like everything else.
 */
@Entity({ name: 'email_log' })
@Index('idx_email_log_created', ['createdAt'])
export class EmailLog {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'to_address', type: 'text' })
  to: string;

  /** e.g. `verify_email`, `password_reset`, `password_changed`. */
  @Column({ name: 'kind', type: 'text' })
  kind: string;

  /** `sent` | `failed` | `not_configured`. */
  @Column({ name: 'status', type: 'text' })
  status: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'provider_message_id', type: 'text', nullable: true })
  providerMessageId: string | null;

  @Column({ name: 'error', type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
