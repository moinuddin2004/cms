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

/** The seq a cached snapshot holds, if it is the given session's. */
const seqOf = (snap: SessionSnapshot | null | undefined, sessionId: string): number | undefined =>
  snap?.session?.id === sessionId && typeof snap.session.eventSeq === 'number'
    ? snap.session.eventSeq
    : undefined;

/** A key is stale when its own cached seq is missing or older than the event's. */
const behind = (have: number | undefined, seq: number) => have === undefined || have < seq;

/**
 * The query keys a queue event makes stale. The seq is compared PER cached
 * snapshot (session, each board, each my-session): a key already at or above
 * the event's seq is skipped, one that is behind or has no seq is refreshed.
 */
export function queueEventKeys(
  queryClient: QueryClient,
  e: Pick<QueueRealtimeEvent, 'sessionId' | 'entryId' | 'seq'>,
): QueryKey[] {
  const keys: QueryKey[] = [];

  const own = queryClient.getQueryData<SessionSnapshot>(queueKeys.session(e.sessionId));
  if (behind(seqOf(own, e.sessionId), e.seq)) keys.push(queueKeys.session(e.sessionId));

  keys.push(queueKeys.nextPreview(e.sessionId));

  for (const [key, board] of queryClient.getQueriesData<BoardResponse>({
    queryKey: queueKeys.boardAll(),
  })) {
    const lane = board?.lanes?.find((l) => l.snapshot?.session.id === e.sessionId);
    if (behind(seqOf(lane?.snapshot, e.sessionId), e.seq)) keys.push(key);
  }

  for (const [key, mine] of queryClient.getQueriesData<SessionSnapshot | null>({
    queryKey: queueKeys.mySessionAll(),
  })) {
    if (behind(seqOf(mine, e.sessionId), e.seq)) keys.push(key);
  }

  if (e.entryId) keys.push(queueKeys.ticket(e.entryId));
  return keys;
}

/** Keys re-fetched after a (re)connect or a long background: every realtime-driven key. */
export const ALL_REALTIME_KEYS: readonly QueryKey[] = [
  queueKeys.all,
  accessKeys.all,
  notificationKeys.all,
];

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
      request(queueEventKeys(queryClient, e));
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
