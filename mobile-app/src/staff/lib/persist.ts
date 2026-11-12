import type { Query, QueryKey } from '@tanstack/react-query';
import type {
  PersistedClient,
  PersistQueryClientProviderProps,
} from '@tanstack/react-query-persist-client';

import { formatTime, todayYmd } from '@/staff/lib/datetime';

/**
 * What the staff space may write to its encrypted cache (docs/02 §9). Anything
 * not listed here is never persisted — a new feature opts in by adding a rule.
 *
 * Never persisted (M1-11a review #7): patient list / search (their keys hold
 * the search text) and `check-phone` (holds a phone number); `theme` (prefs
 * already cache it); every other sub-resource of a patient.
 */
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

/** Patient details kept on disk (docs/02 §9): the newest by `dataUpdatedAt`. */
export const MAX_PERSISTED_PATIENT_DETAILS = 20;

/** Pure allow-list: may a query with this key be written to disk on `today` (clinic YYYY-MM-DD)? */
export function isPersistableKey(key: QueryKey, today: string): boolean {
  const [root, kind] = key;
  switch (root) {
    case 'access':
      return kind === 'me';
    case 'queue':
      return (kind === 'my-session' || kind === 'board') && key[3] === today;
    case 'appointments':
      // Exactly ['appointments', 'list', orgId, locationId, today] — nothing else
      // (no filter objects, no search text, no detail keys that happen to hold a date).
      return (
        key.length === 5 &&
        kind === 'list' &&
        typeof key[2] === 'string' &&
        typeof key[3] === 'string' &&
        key[4] === today
      );
    case 'patients':
      return kind === 'detail';
    default:
      return false;
  }
}

/** Allow-list ∧ successful only. `today` is read at write time, in the clinic's timezone. */
export function shouldPersistQuery(query: Pick<Query, 'queryKey' | 'state'>, today = todayYmd()) {
  return query.state.status === 'success' && isPersistableKey(query.queryKey, today);
}

export const staffDehydrateOptions: NonNullable<
  PersistQueryClientProviderProps['persistOptions']['dehydrateOptions']
> = {
  shouldDehydrateQuery: (query) => shouldPersistQuery(query),
  // There is no write queue (docs/02 §9): paused mutations are never saved.
  shouldDehydrateMutation: () => false,
};

/** Keep only the newest `MAX_PERSISTED_PATIENT_DETAILS` patient details in a persisted client. */
export function trimPersistedClient<T extends PersistedClient>(persisted: T): T {
  const isDetail = (q: { queryKey: QueryKey }) =>
    q.queryKey[0] === 'patients' && q.queryKey[1] === 'detail';
  const details = persisted.clientState.queries.filter(isDetail);
  if (details.length <= MAX_PERSISTED_PATIENT_DETAILS) return persisted;
  const keep = new Set(
    [...details]
      .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
      .slice(0, MAX_PERSISTED_PATIENT_DETAILS),
  );
  return {
    ...persisted,
    clientState: {
      ...persisted.clientState,
      queries: persisted.clientState.queries.filter((q) => !isDetail(q) || keep.has(q)),
    },
  };
}

interface BusterParts {
  appVersion: string;
  userId: string | null;
  orgId: string | null;
  locationId: string | null;
}

/**
 * Cache identity (docs/02 §9). A different build, user, clinic or location
 * produces a different buster, so the old cache is discarded on restore.
 * Null while the identity is incomplete — nothing may be read or written then.
 */
export function staffPersistBuster({ appVersion, userId, orgId, locationId }: BusterParts) {
  if (!userId || !orgId || !locationId) return null;
  return `${appVersion}:${userId}:${orgId}:${locationId}`;
}

/** "hh:mm" on the clinic's clock for the offline banner, from a query's `dataUpdatedAt`. */
export function savedDataTime(dataUpdatedAt: number | undefined): string | undefined {
  return dataUpdatedAt ? formatTime(dataUpdatedAt) : undefined;
}
