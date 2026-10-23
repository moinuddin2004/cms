import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { ActorSide, AuditAction } from '../audit.enums';

/**
 * Generic append-only audit trail (lab ERD §7): who changed what, with the
 * before/after of only the fields that changed. UPDATE and DELETE are
 * rejected by a trigger (migration LabManagementFoundation).
 *
 * `organization_id` is null for platform-level records (e.g. labs edited by
 * a super admin) — every tenant-owned row carries its organization.
 */
@Entity({ name: 'audit_logs' })
@Index('idx_audit_logs_entity', ['entityType', 'entityId', 'createdAt'])
@Index('idx_audit_logs_org_created', ['organizationId', 'createdAt'])
@Index('idx_audit_logs_subject', ['subjectId', 'createdAt'])
export class AuditLog {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ name: 'entity_type', type: 'varchar', length: 50 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  /**
   * The record this row's history belongs to, when that is not the entity
   * itself (a patient's vitals → the patient). Merged histories read by it.
   */
  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId: string | null;

  @Column({ name: 'action', type: 'enum', enum: AuditAction })
  action: AuditAction;

  /** `{ before, after }` — changed fields only; `before` is null on create. */
  @Column({ name: 'changes', type: 'jsonb', nullable: true })
  changes: {
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
  } | null;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ name: 'actor_side', type: 'enum', enum: ActorSide })
  actorSide: ActorSide;

  @Column({ name: 'ip', type: 'inet', nullable: true })
  ip: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true })
  requestId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
