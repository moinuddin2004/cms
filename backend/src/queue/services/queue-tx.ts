import { EntityManager, In } from 'typeorm';
import { QueueSession } from '../entities/queue-session.entity';
import { QueueEntry } from '../entities/queue-entry.entity';
import { EntryStatus } from '../enums/queue.enums';
import { assertEntryTransition } from '../queue-transitions';
import { QueueErrors } from '../queue.errors';

import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { sqlRows } from 'src/common/database/sql';
import { QueueActor } from '../queue-actor';

export type IdempotencyInput = { key: string; hash: string } | null;

/** Column values for an entry UPDATE; always bumps the optimistic-lock version. */
export function entryPatch(
  patch: Partial<Omit<QueueEntry, 'session' | 'patient' | 'appointment'>>,
): QueryDeepPartialEntity<QueueEntry> {
  return { ...patch, version: () => 'version + 1' };
}

/** Column values for a session UPDATE; always bumps the version. */
export function sessionPatch(
  patch: Partial<Omit<QueueSession, 'doctor' | 'entries'>>,
): QueryDeepPartialEntity<QueueSession> {
  return { ...patch, version: () => 'version + 1' };
}

export interface EventInput {
  entry?: QueueEntry | null;
  eventType: string;
  from?: EntryStatus | null;
  to?: EntryStatus | null;
  reasonCode?: string | null;
  reasonText?: string | null;
  suggestedEntryId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * One transaction's worth of queue work: the session lock, entry updates
 * checked against the transition map, and audit + outbox rows — all
 * committed together or not at all.
 */
export class QueueTx {
  constructor(
    readonly manager: EntityManager,
    readonly now: Date,
    readonly ctx: TenantContext,
    readonly actor: QueueActor,
  ) {}

  get actorRole(): string {
    return this.actor.label;
  }

  /** Lock order rule: always the session first, then its entries. */
  async lockSession(sessionId: string): Promise<QueueSession> {
    const session = await this.manager
      .getRepository(QueueSession)
      .createQueryBuilder('s')
      .setLock('pessimistic_write')
      .where('s.id = :sessionId', { sessionId })
      .andWhere('s.organization_id = :org', { org: this.ctx.organizationId })
      .andWhere('s.location_id = :loc', { loc: this.ctx.locationId })
      .getOne();
    if (!session) throw QueueErrors.notFound('Queue session');
    return session;
  }

  /** Lock the entry's session, then read the entry fresh under that lock. */
  async lockEntry(
    entryId: string,
  ): Promise<{ entry: QueueEntry; session: QueueSession }> {
    const ref = await this.manager.getRepository(QueueEntry).findOne({
      where: { id: entryId, organizationId: this.ctx.organizationId },
      select: { id: true, queueSessionId: true },
    });
    if (!ref) throw QueueErrors.notFound('Queue entry');
    const session = await this.lockSession(ref.queueSessionId);
    const entry = await this.loadEntry(entryId);
    return { entry, session };
  }

  async loadEntry(entryId: string): Promise<QueueEntry> {
    const entry = await this.manager.getRepository(QueueEntry).findOne({
      where: { id: entryId },
      relations: { patient: true, appointment: true },
    });
    if (!entry) throw QueueErrors.notFound('Queue entry');
    return entry;
  }

  async sessionEntries(
    sessionId: string,
    statuses?: EntryStatus[],
  ): Promise<QueueEntry[]> {
    return this.manager.getRepository(QueueEntry).find({
      where: {
        queueSessionId: sessionId,
        ...(statuses ? { status: In(statuses) } : {}),
      },
      relations: { patient: true, appointment: true },
    });
  }

  /**
   * Move an entry to `to`. Checks the transition map and (optionally) the
   * client's If-Match version; the UPDATE also re-checks the old status as a
   * defensive guard. Writes the audit event + outbox in the same transaction.
   */
  async transition(
    session: QueueSession,
    entry: QueueEntry,
    to: EntryStatus,
    patch: Partial<QueueEntry>,
    event: Omit<EventInput, 'entry' | 'from' | 'to'>,
    ifMatch?: number,
  ): Promise<void> {
    assertEntryTransition(entry.status, to);
    if (ifMatch !== undefined && ifMatch !== entry.version) {
      throw QueueErrors.versionConflict({
        id: entry.id,
        status: entry.status,
        version: entry.version,
      });
    }
    const from = entry.status;
    const result = await this.manager
      .createQueryBuilder()
      .update(QueueEntry)
      .set(entryPatch({ ...patch, status: to }))
      .where('id = :id AND status = :from', { id: entry.id, from })
      .execute();
    if (!result.affected) {
      throw QueueErrors.versionConflict({ id: entry.id });
    }
    Object.assign(entry, patch, { status: to, version: entry.version + 1 });
    await this.emit(session, { ...event, entry, from, to });
  }

  /**
   * Audit event + outbox messages; bumps the session's event_seq. Two round
   * trips: the seq bump, then one statement that writes the event, the three
   * outbox rows and the NOTIFY that wakes the relay (delivered on commit).
   */
  async emit(session: QueueSession, e: EventInput): Promise<number> {
    const [bumped] = await sqlRows<{ event_seq: string }>(
      this.manager,
      `UPDATE queue_sessions SET event_seq = event_seq + 1 WHERE id = $1 RETURNING event_seq`,
      [session.id],
    );
    const seq = Number(bumped.event_seq);
    session.eventSeq = String(seq);

    // Realtime nudges. Payloads carry ids, statuses and tokens — never
    // patient names — so the display room can share them safely.
    const base = {
      sessionId: session.id,
      seq,
      eventType: e.eventType,
      entryId: e.entry?.id ?? null,
      fromStatus: e.from ?? null,
      toStatus: e.to ?? null,
      occurredAt: this.now.toISOString(),
    };
    const boardPayload = JSON.stringify({ type: 'queue.event', ...base });
    const displayPayload = JSON.stringify({
      type: 'display.event',
      sessionId: session.id,
      seq,
      eventType: e.eventType,
    });

    await sqlRows(
      this.manager,
      `WITH ev AS (
         INSERT INTO queue_events
           (organization_id, queue_session_id, queue_entry_id, seq, event_type,
            from_status, to_status, reason_code, reason_text, suggested_entry_id,
            actor_id, actor_role, metadata, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ), ob AS (
         INSERT INTO outbox (organization_id, topic, payload)
         VALUES ($1, $15, $16), ($1, $17, $16), ($1, $18, $19)
       )
       SELECT pg_notify('queue_outbox', '')`,
      [
        session.organizationId,
        session.id,
        e.entry?.id ?? null,
        seq,
        e.eventType,
        e.from ?? null,
        e.to ?? null,
        e.reasonCode ?? null,
        e.reasonText ?? null,
        e.suggestedEntryId ?? null,
        this.actor.userId,
        this.actorRole,
        JSON.stringify(e.metadata ?? {}),
        this.now,
        `session:${session.id}`,
        boardPayload,
        `location:${session.locationId}:board`,
        `location:${session.locationId}:display`,
        displayPayload,
      ],
    );
    return seq;
  }
}
