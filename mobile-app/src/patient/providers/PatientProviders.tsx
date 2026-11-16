import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MMKV } from 'react-native-mmkv';

import { UrduFontScope } from '@/core/i18n';
import { currentVersion } from '@/core/app-version';
import { openSecureCache } from '@/core/storage/secure-cache';
import { createPatientPersister, idlePersister } from '@/patient/lib/persist-cache';
import {
  PERSIST_MAX_AGE,
  patientDehydrateOptions,
  patientPersistBuster,
} from '@/patient/lib/persist';
import { patientQueryClient } from '@/patient/lib/query-client';
import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

/**
 * The patient space's providers (docs/02 §2): its own query cache, persisted to
 * its own encrypted MMKV. Mounted only while the patient space is active.
 *
 * The encrypted cache opens asynchronously; until it is open — and until the
 * account is known — the provider runs with an idle persister (reads and writes
 * nothing, so it can never discard a saved cache by mistake). `onCacheSettled`
 * fires once the cache is open or failed to open (online-only then).
 */
export function PatientProviders({
  children,
  onCacheSettled,
}: {
  children: ReactNode;
  onCacheSettled?: () => void;
}) {
  const accountId = usePatientAuthStore((s) => s.account?.id ?? null);

  const [cache, setCache] = useState<MMKV | null>(null);
  const hadAccount = useRef(false);
  useEffect(() => {
    // After a sign-out wipe the old handle points at a deleted instance: drop it
    // and open a fresh one only when the next account arrives (never re-create
    // the cache key while signed out).
    if (accountId) hadAccount.current = true;
    else if (hadAccount.current) {
      setCache(null);
      return;
    }
    let live = true;
    openSecureCache('patient')
      .then((opened) => {
        if (live) setCache(opened);
      })
      .catch(() => undefined) // no cache → the app just works online-only
      .finally(() => {
        if (live) onCacheSettled?.();
      });
    return () => {
      live = false;
    };
    // `onCacheSettled` is a stable callback from the layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const buster = patientPersistBuster({ appVersion: currentVersion, accountId });
  const persistKey = cache && buster ? buster : 'idle';
  const persistOptions = useMemo(
    () => ({
      persister: cache && buster ? createPatientPersister(cache) : idlePersister,
      maxAge: PERSIST_MAX_AGE,
      buster: buster ?? '',
      dehydrateOptions: patientDehydrateOptions,
    }),
    // `persistKey` already encodes the cache + buster this depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistKey],
  );

  // `key`: TanStack restores once per mount, so a new account remounts this
  // single provider and restores with its own buster.
  return (
    <PersistQueryClientProvider
      key={persistKey}
      client={patientQueryClient}
      persistOptions={persistOptions}>
      <UrduFontScope>{children}</UrduFontScope>
    </PersistQueryClientProvider>
  );
}
