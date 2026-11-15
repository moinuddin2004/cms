import { currentVersion } from '@/core/app-version';
import { QUERY_CACHE_KEY } from '@/core/storage/query-persister';
import { openSecureCache } from '@/core/storage/secure-cache';

import { PERSIST_MAX_AGE } from './persist';

import type { OfflineHint } from '@/staff/store/useStaffAuthStore';

/** Who the saved staff cache belongs to: ids only — no names, no PHI. */
export type { OfflineHint };

/**
 * Pure: the identity of a raw persisted-client string (what the staff persister
 * wrote into the ENCRYPTED cache), or null when it can't be trusted — unreadable,
 * another app version, older than `PERSIST_MAX_AGE`, empty, or an incomplete
 * identity. The hint is the persisted client's own buster
 * (`appVersion:userId:orgId:locationId`, see `staffPersistBuster`).
 */
export function parseOfflineHint(
  raw: string | null | undefined,
  appVersion: string,
  now: number,
): OfflineHint | null {
  if (!raw) return null;
  let persisted: unknown;
  try {
    persisted = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!persisted || typeof persisted !== 'object') return null;
  const { buster, timestamp, clientState } = persisted as {
    buster?: unknown;
    timestamp?: unknown;
    clientState?: { queries?: unknown };
  };
  if (typeof buster !== 'string' || typeof timestamp !== 'number') return null;
  if (now - timestamp > PERSIST_MAX_AGE) return null;
  if (!Array.isArray(clientState?.queries) || clientState.queries.length === 0) return null;
  const prefix = `${appVersion}:`;
  if (!buster.startsWith(prefix)) return null;
  const [userId, orgId, locationId, ...extra] = buster.slice(prefix.length).split(':');
  if (!userId || !orgId || !locationId || extra.length > 0) return null;
  return { userId, orgId, locationId };
}

/**
 * Read the hint from the encrypted staff cache. Never from prefs (the plain
 * MMKV file must not learn who the user is). Null on any failure.
 */
export async function loadOfflineHint(): Promise<OfflineHint | null> {
  try {
    const cache = await openSecureCache('staff');
    return parseOfflineHint(cache.getString(QUERY_CACHE_KEY), currentVersion, Date.now());
  } catch {
    return null;
  }
}
