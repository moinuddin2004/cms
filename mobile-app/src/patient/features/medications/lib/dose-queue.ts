import type { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { create } from 'zustand';

import { openSecureCache } from '@/core/storage/secure-cache';

import { postDoseEvents } from '../api/medications.api';
import { applySentToCache } from './dose-events-cache';
import type { DoseEvent } from '../types/medications.types';

/**
 * The one offline write of the patient space (docs/06 P-02): "Taken" / "Skipped" are written
 * locally first and sent later. It is the patient's own data and conflict-free — the server upserts
 * per `(scheduleId, dueAt)` and the latest `actedAt` wins, so replays and out-of-order syncs are safe.
 *
 * The queue holds PHI-adjacent ids, so it lives ONLY in the patient's encrypted cache (docs/03) and
 * is wiped with it on sign-out.
 */
const MAX_BATCH = 200;
const storageKey = (accountId: string) => `doseQueue:${accountId}`;

export const queueKey = (e: Pick<DoseEvent, 'scheduleId' | 'dueAt'>) => `${e.scheduleId}|${Date.parse(e.dueAt)}`;

/** Pure: add an event, replacing an older one for the same dose (newer `actedAt` wins). */
export function upsertQueued(queue: readonly DoseEvent[], event: DoseEvent): DoseEvent[] {
  const key = queueKey(event);
  const existing = queue.find((q) => queueKey(q) === key);
  if (existing && Date.parse(existing.actedAt) > Date.parse(event.actedAt)) return [...queue];
  return [...queue.filter((q) => queueKey(q) !== key), event];
}

/** Pure: drop sent events — but keep one the patient changed again while the request was in flight. */
export function removeSent(queue: readonly DoseEvent[], sent: readonly DoseEvent[]): DoseEvent[] {
  return queue.filter((q) => !sent.some((s) => queueKey(s) === queueKey(q) && s.actedAt === q.actedAt));
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface DoseQueueState {
  accountId: string | null;
  items: DoseEvent[];
  /** Load the saved queue of this account (called once the session is known). */
  hydrate: (accountId: string) => Promise<void>;
  /** `false` (nothing saved) until `hydrate` has named the account — callers keep the action disabled until then. */
  enqueue: (event: DoseEvent) => boolean;
  remove: (sent: readonly DoseEvent[]) => void;
  /** Sign-out: memory only — the encrypted cache is wiped by the caller. */
  reset: () => void;
}

async function persist(accountId: string, items: DoseEvent[]): Promise<void> {
  try {
    const cache = await openSecureCache('patient');
    if (items.length === 0) cache.remove(storageKey(accountId));
    else cache.set(storageKey(accountId), JSON.stringify(items));
  } catch {
    // memory copy still works; the next change retries the write
  }
}

export const useDoseQueueStore = create<DoseQueueState>((set, get) => ({
  accountId: null,
  items: [],
  async hydrate(accountId) {
    if (get().accountId === accountId) return;
    set({ accountId, items: [] });
    try {
      const cache = await openSecureCache('patient');
      const raw = cache.getString(storageKey(accountId));
      const saved = raw ? (JSON.parse(raw) as DoseEvent[]) : [];
      if (get().accountId !== accountId) return;
      // Anything enqueued while loading is newer than what was saved.
      const merged = get().items.reduce((acc, e) => upsertQueued(acc, e), saved);
      set({ items: merged });
    } catch {
      // unreadable → start empty
    }
  },
  enqueue(event) {
    const { accountId } = get();
    if (!accountId) return false;
    const items = upsertQueued(get().items, event);
    set({ items });
    void persist(accountId, items);
    return true;
  },
  remove(sent) {
    const { accountId } = get();
    if (!accountId) return;
    const items = removeSent(get().items, sent);
    set({ items });
    void persist(accountId, items);
  },
  reset() {
    set({ accountId: null, items: [] });
  },
}));

const status = (error: unknown): number | null => (isAxiosError(error) ? (error.response?.status ?? null) : null);

/** A request the server will never accept (bad shape, not our schedule): retrying cannot help. */
const isPermanent = (error: unknown) => {
  const s = status(error);
  return s === 400 || s === 404 || s === 422;
};

let flushing: Promise<boolean> | null = null;

/**
 * Sends the queue in batches of ≤ 200. Returns `true` when at least one event was accepted.
 * - network / 5xx / 429 / 401: keep everything, try again later
 * - 400 / 404 on a batch: the server rejects the WHOLE batch for one bad event, so the events are
 *   sent one by one and only the rejected ones are dropped
 */
export function flushDoseQueue(client: QueryClient): Promise<boolean> {
  if (flushing) return flushing;
  flushing = (async () => {
    let any = false;
    const { items, remove, accountId } = useDoseQueueStore.getState();
    if (!accountId) return false;
    // The server copy is patched BEFORE the local one is dropped (see `applySentToCache`).
    const accept = (sent: DoseEvent[]) => {
      // A flush that finishes after sign-out / an account switch must touch nothing: it would
      // re-create the old account's cache entries in the cleared client (audit L12).
      if (useDoseQueueStore.getState().accountId !== accountId) return;
      applySentToCache(client, accountId, sent);
      remove(sent);
    };
    for (const batch of chunk(items, MAX_BATCH)) {
      try {
        await postDoseEvents(batch);
        accept(batch);
        any = true;
      } catch (error) {
        if (!isPermanent(error)) break;
        for (const one of batch) {
          try {
            await postDoseEvents([one]);
            any = true;
            accept([one]);
          } catch (inner) {
            if (isPermanent(inner)) remove([one]);
            else return any;
          }
        }
      }
    }
    return any;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
