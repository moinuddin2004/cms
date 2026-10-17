import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BillingAuditAction, BillingAuditEntity } from '../enums/billing.enums';

/**
 * Append-only audit of every billing state change (6.15). The repo has no
 * general audit module with before/after snapshots (V7), so billing keeps
 * its own. Invoice EDITED rows hold full snapshots used for revisions.
 */
@Entity({ name: 'billing_audit_logs' })
@Index('idx_billing_audit_org_loc_created', [
  'organizationId',
  'locationId',
  'createdAt',
])
@Index('idx_billing_audit_entity', ['entityType', 'entityId'])
export class BillingAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /** Null only for org-level entities (services, discount types). */
  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId: string | null;

  @Column({ name: 'entity_type', type: 'enum', enum: BillingAuditEntity })
  entityType: BillingAuditEntity;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ name: 'action', type: 'enum', enum: BillingAuditAction })
  action: BillingAuditAction;

  @Column({ name: 'before', type: 'jsonb', nullable: true })
  before: Record<string, unknown> | null;

  @Column({ name: 'after', type: 'jsonb', nullable: true })
  after: Record<string, unknown> | null;

  /** Money moved by the action, for activity totals. */
  @Column({
    name: 'amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  amount: string | null;

  @Column({ name: 'reason', type: 'varchar', length: 300, nullable: true })
  reason: string | null;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ name: 'actor_role', type: 'varchar', length: 30 })
  actorRole: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
