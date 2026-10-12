import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * Transactional outbox: realtime messages are written in the same transaction
 * as the queue change, then published by the relay. Screens therefore never
 * see a change that rolled back, and never miss one that committed.
 */
@Entity({ name: 'outbox' })
@Index('outbox_unpublished', ['id'], { where: `"published_at" IS NULL` })
export class OutboxMessage {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /** Socket room, e.g. `session:<id>` or `location:<id>:display`. */
  @Column({ name: 'topic', type: 'text' })
  topic: string;

  @Column({ name: 'payload', type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;
}
