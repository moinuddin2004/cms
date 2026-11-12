import type { Persister } from '@tanstack/react-query-persist-client';

import { openSecureCache, wipeSecureCache } from '@/core/storage/secure-cache';
import { createSecureQueryPersister } from '@/core/storage/query-persister';

import { trimPersistedClient } from './persist';

/** A persister that reads nothing and writes nothing (identity not known yet, or signing out). */
export const idlePersister: Persister = {
  persistClient: () => undefined,
  restoreClient: () => Promise.resolve(undefined),
  removeClient: () => undefined,
};

/** One seal per live persister instance; sign-out seals them all (never a module-wide flag). */
const liveSeals = new Set<{ sealed: boolean }>();

/**
 * The staff persister over the encrypted cache. TanStack throttles writes, so a
 * trailing write could land after sign-out: the seal is checked inside the
 * storage `setItem`/`removeItem` (at write time), not when `persistClient` is called.
 */
export function createStaffPersister(cache: Parameters<typeof createSecureQueryPersister>[0]): Persister {
  const seal = { sealed: false };
  liveSeals.add(seal);
  const inner = createSecureQueryPersister(cache, undefined, () => !seal.sealed);
  return {
    persistClient: (client) => inner.persistClient(trimPersistedClient(client)),
    restoreClient: () => inner.restoreClient(),
    removeClient: () => inner.removeClient(),
  };
}

/** Sign-out: seal every live persister, remove the persisted client, then wipe the encrypted cache and its key. */
export async function wipeStaffPersistedCache(): Promise<void> {
  for (const seal of liveSeals) seal.sealed = true;
  liveSeals.clear();
  try {
    await createSecureQueryPersister(await openSecureCache('staff')).removeClient();
  } finally {
    await wipeSecureCache('staff');
  }
}
