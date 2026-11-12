import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import type { MMKV } from 'react-native-mmkv';

import { currentVersion } from '@/core/app-version';
import { markReady } from '@/core/splash';
import { openSecureCache } from '@/core/storage/secure-cache';
import { applyBrand } from '@/core/theme/apply-brand';
import { applyThemeMode } from '@/core/theme/apply-theme-mode';
import { applyTextScale } from '@/core/theme/apply-text-scale';
import { useRestoreStaffSession } from '@/staff/features/auth';
import { applyCachedBrand } from '@/staff/features/theme';
import { createStaffPersister, idlePersister } from '@/staff/lib/persist-cache';
import {
  PERSIST_MAX_AGE,
  staffDehydrateOptions,
  staffPersistBuster,
} from '@/staff/lib/persist';
import { staffQueryClient } from '@/staff/lib/query-client';
import {
  activeClinicBlock,
  needsLocationSelection,
  useStaffAuthStore,
} from '@/staff/store/useStaffAuthStore';

import { resolveStaffRoute } from './resolve-staff-route';

/**
 * The staff space's layout (docs/02 §2, §4): its own query cache, its own
 * session restore, and the login / select-location / main guards. Mounted only
 * while the staff space is active, so nothing here runs for the patient space.
 *
 * The `<Stack>` always renders — returning `null` during restore would leave
 * Expo Router without a navigator. The root splash covers the restoring frame.
 */
export function StaffLayout() {
  const restore = useRestoreStaffSession();
  const status = useStaffAuthStore((s) => s.status);
  const mustSelectLocation = useStaffAuthStore((s) => needsLocationSelection(s));
  const clinicBlocked = useStaffAuthStore((s) => activeClinicBlock(s) !== null);
  const userId = useStaffAuthStore((s) => s.user?.uuid ?? null);
  const orgId = useStaffAuthStore((s) => s.activeOrganizationId);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);

  useEffect(() => {
    void restore();
  }, [restore]);

  // The encrypted offline cache opens asynchronously. Until it is open — and
  // until user + clinic + location are known — the one provider below runs with
  // an idle persister (reads and writes nothing, so it can never discard a
  // saved cache by mistake).
  const [cache, setCache] = useState<MMKV | null>(null);
  const [cacheSettled, setCacheSettled] = useState(false);
  useEffect(() => {
    let live = true;
    openSecureCache('staff')
      .then((opened) => {
        if (live) setCache(opened);
      })
      .catch(() => undefined) // no cache → the app just works online-only
      .finally(() => {
        if (live) setCacheSettled(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const buster = staffPersistBuster({ appVersion: currentVersion, userId, orgId, locationId });
  const persistKey = cache && buster ? buster : 'idle';
  const persistOptions = useMemo(
    () => ({
      persister: cache && buster ? createStaffPersister(cache) : idlePersister,
      maxAge: PERSIST_MAX_AGE,
      buster: buster ?? '',
      dehydrateOptions: staffDehydrateOptions,
    }),
    // `persistKey` already encodes the cache + buster this depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistKey],
  );

  // The clinic brand is painted from prefs before the theme query answers, so
  // a returning user never sees the platform colour (docs/10 M0-05 step 4).
  // Leaving the staff space restores the platform palette: the welcome screen
  // is never branded, and the forced light/dark mode goes back to the phone's.
  useEffect(() => {
    applyTextScale('staff');
    applyCachedBrand();
    return () => {
      applyBrand(null);
      applyThemeMode('system');
      applyTextScale('staff');
    };
  }, []);

  useEffect(() => {
    // The splash stays up until the session is restored and the cache is open (or failed to).
    if (status !== 'restoring' && cacheSettled) markReady();
  }, [status, cacheSettled]);

  const route = resolveStaffRoute({ status, mustSelectLocation, clinicBlocked });

  // `key`: TanStack restores once per mount, so a new user / clinic / location
  // remounts this single provider (never a second tree) and restores with its
  // own buster — a different identity's cache is discarded.
  return (
    <PersistQueryClientProvider
      key={persistKey}
      client={staffQueryClient}
      persistOptions={persistOptions}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={route === 'offline'}>
          <Stack.Screen name="offline" />
        </Stack.Protected>
        <Stack.Protected guard={route === 'login'}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={route === 'select-location'}>
          <Stack.Screen name="select-location" />
        </Stack.Protected>
        <Stack.Protected guard={route === 'main'}>
          <Stack.Screen name="(main)" />
        </Stack.Protected>
      </Stack>
    </PersistQueryClientProvider>
  );
}
