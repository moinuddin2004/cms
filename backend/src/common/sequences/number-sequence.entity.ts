import {
  Check,
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Gapless per-organization counters for human numbers (LAB-0001, SHP-0001 …).
 * Only touched through `NumberSequenceService.next()` inside a transaction.
 */
@Entity({ name: 'number_sequences' })
@Check('chk_number_sequences_next_value', `"next_value" > 0`)
export class NumberSequence {
  @PrimaryColumn({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @PrimaryColumn({ name: 'sequence_key', type: 'varchar', length: 30 })
  sequenceKey: string;

  @Column({ name: 'prefix', type: 'varchar', length: 10 })
  prefix: string;

  @Column({ name: 'next_value', type: 'bigint', default: 1 })
  nextValue: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
