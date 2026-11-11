import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { Persister } from '@tanstack/react-query-persist-client';
import type { MMKV } from 'react-native-mmkv';

/**
 * TanStack Query persistence over one space's encrypted MMKV cache. Only the
 * adapter lives here; the provider, allow-list, maxAge and buster are wired in
 * M1-06 (docs/02 §9).
 */
export const QUERY_CACHE_KEY = 'query-cache';

/** Adapt MMKV's synchronous API to TanStack's synchronous storage persister. */
export function createSecureQueryPersister(
  cache: MMKV,
  key: string = QUERY_CACHE_KEY,
): Persister {
  return createSyncStoragePersister({
    key,
    storage: {
      getItem: (name) => cache.getString(name) ?? null,
      setItem: (name, value) => {
        cache.set(name, value);
      },
      removeItem: (name) => {
        cache.remove(name);
      },
    },
  });
}
