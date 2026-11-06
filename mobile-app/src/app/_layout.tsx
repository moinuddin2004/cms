import '@/global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { ErrorState } from '@/components/feedback/ErrorState';
import { useRestoreSession } from '@/features/auth';
import { AppProviders } from '@/providers/AppProviders';
import { activeClinicBlock, needsLocationSelection, useAuthStore } from '@/store/useAuthStore';

SplashScreen.preventAutoHideAsync();

/**
 * Route guards live here (the mobile twin of the web app's `__root.tsx`):
 * signed out → login · signed in without a clinic/location (or a blocked clinic)
 * → select-location · otherwise the app.
 */
function RootNavigator() {
  const restore = useRestoreSession();
  const status = useAuthStore((s) => s.status);
  const mustSelect = useAuthStore(
    (s) => needsLocationSelection(s) || activeClinicBlock(s) !== null,
  );

  useEffect(() => {
    if (status !== 'restoring') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'restoring') return null; // the native splash is still showing

  if (status === 'unreachable') {
    return (
      <ErrorState
        title="Can't reach the server"
        message="Your session is saved. Check your connection and try again."
        onRetry={() => void restore()}
      />
    );
  }

  const signedIn = status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && mustSelect}>
        <Stack.Screen name="select-location" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !mustSelect}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
