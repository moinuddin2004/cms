import type { QueryClient, QueryKey } from '@tanstack/react-query';

// Key modules are imported directly, not through the feature barrels: this file is
// pure logic and must not drag screens / native UI into the realtime layer.
import { accessKeys } from '@/staff/features/access/hooks/useMyAccess';
import { notificationKeys } from '@/staff/features/notifications/api/notifications.keys';
import { queueKeys } from '@/staff/features/queue/api/queue.keys';
import type { BoardResponse, SessionSnapshot } from '@/staff/features/queue/types/queue.types';

/** Realtime only INVALIDATES queries — it never writes into the cache (decision A-07). */

/** Payload of `queue.event` (docs/07 §2.6). */
export interface QueueRealtimeEvent {
  type?: 'queue.event';
  sessionId: string;
  seq: number;
  eventType?: string;
  entryId?: string | null;
}

/** Coalescing window: a key is invalidated at most once per window. */
export const COALESCE_MS = 300;

/** The query keys a queue event makes stale (the single mapping table for queue). */
export function queueEventKeys(e: Pick<QueueRealtimeEvent, 'sessionId' | 'entryId'>): QueryKey[] {
  const keys: QueryKey[] = [
    queueKeys.session(e.sessionId),
    queueKeys.nextPreview(e.sessionId),
    [...queueKeys.all, 'board'],
    [...queueKeys.all, 'my-session'],
  ];
  if (e.entryId) keys.push(queueKeys.ticket(e.entryId));
  return keys;
}

/** Keys re-fetched after a (re)connect or a long background: every realtime-driven key. */
export const ALL_REALTIME_KEYS: readonly QueryKey[] = [
  queueKeys.all,
  accessKeys.all,
  notificationKeys.all,
];

/**
 * The newest `eventSeq` the cache holds for a session (its own snapshot, the
 * board lanes, or my-session), or `undefined` when nothing is cached.
 */
export function cachedEventSeq(queryClient: QueryClient, sessionId: string): number | undefined {
  const seqs: number[] = [];

  const own = queryClient.getQueryData<SessionSnapshot>(queueKeys.session(sessionId));
  if (typeof own?.session?.eventSeq === 'number') seqs.push(own.session.eventSeq);

  for (const [, board] of queryClient.getQueriesData<BoardResponse>({
    queryKey: [...queueKeys.all, 'board'],
  })) {
    for (const lane of board?.lanes ?? []) {
      const snap = lane.snapshot;
      if (snap?.session.id === sessionId && typeof snap.session.eventSeq === 'number') {
        seqs.push(snap.session.eventSeq);
      }
    }
  }

  for (const [, mine] of queryClient.getQueriesData<SessionSnapshot | null>({
    queryKey: [...queueKeys.all, 'my-session'],
  })) {
    if (mine?.session?.id === sessionId && typeof mine.session.eventSeq === 'number') {
      seqs.push(mine.session.eventSeq);
    }
  }

  return seqs.length ? Math.max(...seqs) : undefined;
}

/** True when the event is not newer than what the cache already holds. */
export function isStaleQueueEvent(queryClient: QueryClient, e: QueueRealtimeEvent): boolean {
  const have = cachedEventSeq(queryClient, e.sessionId);
  return have !== undefined && e.seq <= have;
}

export interface RealtimeInvalidator {
  queueEvent: (e: QueueRealtimeEvent) => void;
  accessChanged: () => void;
  notificationNew: () => void;
  /** After a reconnect / foreground: events may have been missed. */
  all: () => void;
  dispose: () => void;
}

/**
 * Event → invalidation, coalesced: the first request for a key starts a
 * `windowMs` timer; every request for any key in that window joins it, and
 * each distinct key is invalidated once when it fires.
 */
export function createRealtimeInvalidator(
  queryClient: QueryClient,
  windowMs: number = COALESCE_MS,
): RealtimeInvalidator {
  const pending = new Map<string, QueryKey>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    const keys = [...pending.values()];
    pending.clear();
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
  };

  const request = (keys: readonly QueryKey[]) => {
    for (const key of keys) pending.set(JSON.stringify(key), key);
    timer ??= setTimeout(flush, windowMs);
  };

  return {
    queueEvent: (e) => {
      if (isStaleQueueEvent(queryClient, e)) return;
      request(queueEventKeys(e));
    },
    accessChanged: () => request([accessKeys.all]),
    notificationNew: () => request([notificationKeys.all]),
    all: () => request(ALL_REALTIME_KEYS),
    dispose: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      pending.clear();
    },
  };
}
