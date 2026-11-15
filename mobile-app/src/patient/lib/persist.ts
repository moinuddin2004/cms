import type { Query, QueryKey } from '@tanstack/react-query';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';

/** 24 h — the query client's gcTime must be >= this (docs/02 §9). */
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Query roots the patient space may write to its encrypted cache (docs/02 §9:
 * links, profiles, today feed, medications, upcoming appointments, prescription
 * list). Each feature card adds its
 * root here together with the query.
 */
const PERSISTABLE_ROOTS: ReadonlySet<string> = new Set<string>([
  // M2-09: upcoming appointments + prescription list (docs/02 sec. 9). Visits, details and bills are online-only.
  'records-appointments',
  'records-prescriptions',
]);

export function isPersistableKey(key: QueryKey): boolean {
  return typeof key[0] === 'string' && PERSISTABLE_ROOTS.has(key[0]);
}

export function shouldPersistQuery(query: Pick<Query, 'queryKey' | 'state'>): boolean {
  return query.state.status === 'success' && isPersistableKey(query.queryKey);
}

export const patientDehydrateOptions: NonNullable<
  PersistQueryClientProviderProps['persistOptions']['dehydrateOptions']
> = {
  shouldDehydrateQuery: (query) => shouldPersistQuery(query),
  // There is no write queue (docs/02 §9): paused mutations are never saved.
  shouldDehydrateMutation: () => false,
};

/** Cache buster: a different build or account discards the saved cache. */
export function patientPersistBuster(parts: {
  appVersion: string;
  accountId: string | null;
}): string | null {
  return parts.accountId ? `${parts.appVersion}:${parts.accountId}` : null;
}
