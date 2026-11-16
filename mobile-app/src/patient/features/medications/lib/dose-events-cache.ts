import type { QueryClient } from '@tanstack/react-query';

import { medicationKeys } from '../api/medications.keys';
import type { DoseEvent } from '../types/medications.types';
import { DAY_MS, localDayStart, localYmd } from './doses';

const dueMs = (e: Pick<DoseEvent, 'dueAt'>) => Date.parse(e.dueAt);
const actedMs = (e: Pick<DoseEvent, 'actedAt'>) => {
  const n = Date.parse(e.actedAt);
  return Number.isNaN(n) ? 0 : n;
};

/** Pure: `sent` events folded into `base` — one event per dose, the newer `actedAt` wins. */
export function mergeDoseEvents(base: readonly DoseEvent[], sent: readonly DoseEvent[]): DoseEvent[] {
  const byDose = new Map<string, DoseEvent>();
  for (const e of [...base, ...sent]) {
    const key = `${e.scheduleId}|${dueMs(e)}`;
    const prev = byDose.get(key);
    if (!prev || actedMs(e) >= actedMs(prev)) byDose.set(key, e);
  }
  return [...byDose.values()];
}

/** The dose-event window: yesterday 00:00 up to 6 days later (= through the end of day +4), phone clock. */
export function doseEventsWindow(nowMs: number): { fromMs: number; toMs: number; fromYmd: string } {
  const fromMs = localDayStart(nowMs, -1);
  return { fromMs, toMs: fromMs + 6 * DAY_MS, fromYmd: localYmd(fromMs) };
}

/**
 * Called right BEFORE a sent event leaves the local queue: the server copy has not been refetched
 * yet, and without this the dose would flash back to "not taken" (double-dose risk) and its reminder
 * would be re-planned. Existing `['dose-events', accountId, *]` queries are patched; if none exists
 * the current window's query is created with the sent events (the invalidate that follows a flush
 * refetches it).
 */
export function applySentToCache(client: QueryClient, accountId: string, sent: readonly DoseEvent[]): void {
  const root = ['dose-events', accountId] as const;
  const existing = client.getQueriesData<DoseEvent[]>({ queryKey: root });
  if (existing.length === 0) {
    client.setQueryData<DoseEvent[]>(
      medicationKeys.doseEvents(accountId, doseEventsWindow(Date.now()).fromYmd),
      [...sent],
    );
    return;
  }
  client.setQueriesData<DoseEvent[]>({ queryKey: root }, (old) => mergeDoseEvents(old ?? [], sent));
}
