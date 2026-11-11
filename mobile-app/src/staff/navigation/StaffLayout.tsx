import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { markReady } from '@/core/splash';
import { useRestoreStaffSession } from '@/staff/features/auth';
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
