import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { markReady } from '@/core/splash';
import { applyBrand } from '@/core/theme/apply-brand';
import { applyThemeMode } from '@/core/theme/apply-theme-mode';
import { applyTextScale } from '@/core/theme/apply-text-scale';
import { useRestoreStaffSession } from '@/staff/features/auth';
import { applyCachedBrand } from '@/staff/features/theme';
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

  useEffect(() => {
    void restore();
  }, [restore]);

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
    if (status !== 'restoring') markReady();
  }, [status]);

  const route = resolveStaffRoute({ status, mustSelectLocation, clinicBlocked });

  return (
    <QueryClientProvider client={staffQueryClient}>
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
    </QueryClientProvider>
  );
}
