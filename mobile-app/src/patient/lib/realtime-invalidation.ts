import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { linkKeys } from '@/patient/features/clinics/api/clinics.keys';
import { profileKeys } from '@/patient/features/profiles/api/profiles.keys';
import { queueKeys } from '@/patient/features/queue/api/queue.keys';

/** Realtime only INVALIDATES queries — it never writes into the cache (decision A-07). */

/** A key is invalidated at most once per window (the burst of events one queue move causes). */
export const COALESCE_MS = 150;

/** Query roots a `feed.changed` kind makes stale (docs/07 §7). Unknown roots are harmless. */
const FEED_KEYS: Record<string, readonly QueryKey[]> = {
  medications: [['medications']],
  appointments: [['records-appointments'], ['records-appointments-upcoming']],
  links: [linkKeys.all, profileKeys.all, queueKeys.all],
};

export interface PatientInvalidator {
  /** `visit.event { entryId, seq }` — ids only, so the answer is a refetch. */
  visitEvent: (e: { entryId?: string; seq?: number }) => void;
  feedChanged: (e: { kinds?: string[] }) => void;
  /** After a reconnect / foreground / socket loss: events may have been missed. */
  all: () => void;
  dispose: () => void;
}

export function createPatientInvalidator(
  queryClient: QueryClient,
  windowMs: number = COALESCE_MS,
): PatientInvalidator {
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
    visitEvent: () => request([queueKeys.all]),
    feedChanged: (e) => request((e.kinds ?? []).flatMap((k) => FEED_KEYS[k] ?? [])),
    all: () => request([queueKeys.all]),
    dispose: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      pending.clear();
    },
  };
}
