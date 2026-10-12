import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Stored result of a queue mutation, keyed by the client's Idempotency-Key.
 * A retry with the same key returns the saved response instead of doing the
 * work twice (e.g. a check-in whose reply was lost returns the same token).
 */
@Entity({ name: 'idempotency_keys' })
export class IdempotencyKey {
  @PrimaryColumn({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @PrimaryColumn({ name: 'key', type: 'text' })
  key: string;

  @Column({ name: 'request_hash', type: 'text' })
  requestHash: string;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus: number | null;

  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  responseBody: unknown;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
