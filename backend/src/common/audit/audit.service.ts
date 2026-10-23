import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { sqlRows } from 'src/common/database/sql';
import { ActorRef, ActorSide, AuditAction, TransitionVia } from './audit.enums';
import { diffSnapshots, Snapshot } from './audit-diff';
import { AuditLog } from './entities/audit-log.entity';
import { StatusHistory } from './entities/status-history.entity';

export interface AuditEntry {
  /** Null for platform-level records. */
  organizationId: string | null;
  entityType: string;
  entityId: string;
  action: AuditAction;
  /** Omit on create. On update only changed fields are stored. */
  before?: Snapshot | null;
  after?: Snapshot | null;
  /** The record whose merged history this joins (see `AuditLog.subjectId`). */
  subjectId?: string | null;
}

export interface StatusChange {
  organizationId: string;
  entityType: string;
  entityId: string;
  subjectId?: string | null;
  fromState: string | null;
  toState: string;
  actionCode: string;
  via?: TransitionVia;
  onBehalfOfLabId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** One row of an entity's merged history (audit + status changes). */
export interface TimelineEntry {
  id: string;
  kind: 'audit' | 'status';
  entityType: string;
  entityId: string;
  action: string;
  fromState: string | null;
  toState: string | null;
  changes: AuditLog['changes'];
  reason: string | null;
  actorSide: ActorSide;
  via: TransitionVia | null;
  actor: { id: string; name: string | null } | null;
  createdAt: Date;
}

/**
 * Writes `audit_logs` and `status_history` — both append-only — always in
 * the caller's transaction, so history commits or rolls back with the change
 * it describes.
 */
@Injectable()
export class AuditService {
  /** Returns false (and writes nothing) for an update that changed nothing. */
  async record(
    manager: EntityManager,
    actor: ActorRef,
    entry: AuditEntry,
  ): Promise<boolean> {
    let changes: AuditLog['changes'] = null;
    if (entry.before && entry.after) {
      changes = diffSnapshots(entry.before, entry.after);
      if (!changes && entry.action === AuditAction.UPDATE) return false;
    } else if (entry.before || entry.after) {
      changes = { before: entry.before ?? null, after: entry.after ?? null };
    }

    const repo = manager.getRepository(AuditLog);
    await repo.save(
      repo.create({
        organizationId: entry.organizationId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        subjectId: entry.subjectId ?? null,
        action: entry.action,
        changes,
        actorUserId: actor.userId,
        actorSide: actor.side,
        ip: actor.ip ?? null,
        requestId: actor.requestId ?? null,
      }),
      { reload: false },
    );
    return true;
  }

  async recordStatus(
    manager: EntityManager,
    actor: ActorRef,
    change: StatusChange,
  ): Promise<void> {
    const repo = manager.getRepository(StatusHistory);
    await repo.save(
      repo.create({
        organizationId: change.organizationId,
        entityType: change.entityType,
        entityId: change.entityId,
        subjectId: change.subjectId ?? null,
        fromState: change.fromState,
        toState: change.toState,
        actionCode: change.actionCode,
        actorUserId: actor.userId,
        actorSide: actor.side,
        via: change.via ?? TransitionVia.APP,
        onBehalfOfLabId: change.onBehalfOfLabId ?? null,
        reason: change.reason ?? null,
        metadata: change.metadata ?? null,
      }),
      { reload: false },
    );
  }

  /** The side that made the latest transition into `toState`, if any. */
  async lastTransitionSide(
    manager: EntityManager,
    entityType: string,
    entityId: string,
    toState: string,
  ): Promise<ActorSide | null> {
    const [row] = await sqlRows<{ actor_side: ActorSide }>(
      manager,
      `SELECT actor_side FROM status_history
        WHERE entity_type = $1 AND entity_id = $2 AND to_state = $3
        ORDER BY created_at DESC, id DESC LIMIT 1`,
      [entityType, entityId, toState],
    );
    return row?.actor_side ?? null;
  }

  /**
   * Newest-first merged history of one entity. `organizationId` scopes the
   * read to a tenant; pass null only from platform (super admin) routes.
   */
  async timeline(
    manager: EntityManager,
    entityType: string,
    entityId: string,
    organizationId: string | null,
    limit = 100,
  ): Promise<TimelineEntry[]> {
    return this.readTimeline(
      manager,
      'entity_type = $1 AND entity_id = $2',
      [entityType, entityId],
      organizationId,
      limit,
    );
  }

  /**
   * Newest-first merged history of everything recorded under one subject —
   * e.g. a patient and all of their clinical records.
   */
  async subjectTimeline(
    manager: EntityManager,
    subjectId: string,
    organizationId: string,
    limit = 200,
  ): Promise<TimelineEntry[]> {
    return this.readTimeline(
      manager,
      'subject_id = $1',
      [subjectId],
      organizationId,
      limit,
    );
  }

  /** `where` filters both tables; it uses $1..$n of `params` only. */
  private async readTimeline(
    manager: EntityManager,
    where: string,
    params: unknown[],
    organizationId: string | null,
    limit: number,
  ): Promise<TimelineEntry[]> {
    const org = `$${params.length + 1}`;
    const lim = `$${params.length + 2}`;
    const rows = await sqlRows<{
      id: string;
      kind: 'audit' | 'status';
      entity_type: string;
      entity_id: string;
      action: string;
      from_state: string | null;
      to_state: string | null;
      changes: AuditLog['changes'];
      reason: string | null;
      actor_side: ActorSide;
      via: TransitionVia | null;
      actor_user_id: string | null;
      actor_name: string | null;
      created_at: Date;
    }>(
      manager,
      `SELECT t.*, COALESCE(u.name, u.email) AS actor_name
         FROM (
           SELECT id, 'audit' AS kind, entity_type, entity_id, action::text AS action,
                  NULL AS from_state, NULL AS to_state, changes, NULL AS reason,
                  actor_side::text AS actor_side, NULL AS via, actor_user_id, created_at
             FROM audit_logs
            WHERE ${where}
              AND (${org}::uuid IS NULL OR organization_id = ${org})
           UNION ALL
           SELECT id, 'status', entity_type, entity_id, action_code, from_state, to_state,
                  NULL, reason, actor_side::text, via::text, actor_user_id, created_at
             FROM status_history
            WHERE ${where}
              AND (${org}::uuid IS NULL OR organization_id = ${org})
         ) t
         LEFT JOIN users u ON u.uuid = t.actor_user_id
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ${lim}`,
      [...params, organizationId, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      fromState: r.from_state,
      toState: r.to_state,
      changes: r.changes,
      reason: r.reason,
      actorSide: r.actor_side,
      via: r.via,
      actor: r.actor_user_id
        ? { id: r.actor_user_id, name: r.actor_name }
        : null,
      createdAt: r.created_at,
    }));
  }
}
