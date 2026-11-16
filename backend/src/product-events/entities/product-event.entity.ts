import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Privacy-safe product analytics (M2-13). One row per event: an allow-listed
 * name + allow-listed scalar props, who (account/user id only) and when.
 * No FKs on purpose: rows outlive the account and hold nothing health-related.
 */
@Entity({ name: 'product_events' })
@Index('idx_product_events_name_at', ['name', 'at'])
@Check(
  'chk_product_events_actor_type',
  `"actor_type" IN ('staff', 'patient', 'anon')`,
)
export class ProductEvent {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  /** staff | patient | anon */
  @Column({ name: 'actor_type', type: 'varchar', length: 10 })
  actorType: string;

  /** `users.uuid` (staff) or `patient_accounts.id` (patient). */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  /** Never client-supplied; always null for now. Org tagging (and an (organization_id, name, at) index) is future work. */
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ name: 'name', type: 'varchar', length: 60 })
  name: string;

  @Column({ name: 'props', type: 'jsonb', default: () => `'{}'` })
  props: Record<string, string>;

  @Column({ name: 'at', type: 'timestamptz', default: () => 'now()' })
  at: Date;
}
