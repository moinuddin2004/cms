import type { Query, QueryKey } from '@tanstack/react-query';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';

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

const isPrimitive = (v: unknown) =>
  v === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof v);

/** Pure allow-list: may a query with this key be written to disk on `today` (clinic YYYY-MM-DD)? */
export function isPersistableKey(key: QueryKey, today: string): boolean {
  const [root, kind] = key;
  switch (root) {
    case 'access':
      return kind === 'me';
    case 'queue':
      return (kind === 'my-session' || kind === 'board') && key[3] === today;
    case 'appointments':
      // Today's schedule only; a key holding an object (filters / search) never qualifies.
      return key.every(isPrimitive) && key.includes(today);
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
