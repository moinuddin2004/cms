import type { Persister } from '@tanstack/react-query-persist-client';

import { createSecureQueryPersister } from '@/core/storage/query-persister';
import { openSecureCache, wipeSecureCache } from '@/core/storage/secure-cache';

/** A persister that reads nothing and writes nothing (identity not known yet, or signing out). */
export const idlePersister: Persister = {
  persistClient: () => undefined,
  restoreClient: () => Promise.resolve(undefined),
  removeClient: () => undefined,
};

const liveSeals = new Set<{ sealed: boolean }>();

/**
 * The patient persister over the encrypted cache. TanStack throttles writes, so
 * a trailing write could land after sign-out: the seal is checked inside the
 * storage `setItem`/`removeItem` (at write time).
 */
export function createPatientPersister(
  cache: Parameters<typeof createSecureQueryPersister>[0],
): Persister {
  const seal = { sealed: false };
  liveSeals.add(seal);
  return createSecureQueryPersister(cache, undefined, () => !seal.sealed);
}

/** Sign-out: seal every live persister, remove the persisted client, then wipe the PATIENT cache and its key. Staff is untouched. */
export async function wipePatientPersistedCache(): Promise<void> {
  for (const seal of liveSeals) seal.sealed = true;
  liveSeals.clear();
  try {
    await createSecureQueryPersister(await openSecureCache('patient')).removeClient();
  } finally {
    await wipeSecureCache('patient');
  }
}
