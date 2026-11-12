import type { Persister } from '@tanstack/react-query-persist-client';

import { openSecureCache, wipeSecureCache } from '@/core/storage/secure-cache';
import { createSecureQueryPersister } from '@/core/storage/query-persister';

/** A persister that reads nothing and writes nothing (identity not known yet, or signing out). */
export const idlePersister: Persister = {
  persistClient: () => undefined,
  restoreClient: () => Promise.resolve(undefined),
  removeClient: () => undefined,
};

let sealed = false;

/**
 * The staff persister over the encrypted cache. TanStack throttles writes, so a
 * trailing write could land after sign-out; `sealStaffPersist` stops it.
 */
export function createStaffPersister(cache: Parameters<typeof createSecureQueryPersister>[0]): Persister {
  sealed = false; // a new sign-in
  const inner = createSecureQueryPersister(cache);
  return {
    persistClient: (client) => {
      if (!sealed) return inner.persistClient(client);
    },
    restoreClient: () => inner.restoreClient(),
    removeClient: () => inner.removeClient(),
  };
}

/** Sign-out: remove the persisted client, stop late writes, then wipe the encrypted cache and its key. */
export async function wipeStaffPersistedCache(): Promise<void> {
  sealed = true;
  try {
    await createSecureQueryPersister(await openSecureCache('staff')).removeClient();
  } finally {
    await wipeSecureCache('staff');
  }
}
