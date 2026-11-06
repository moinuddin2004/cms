import '@/global.css';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useRestoreSession } from '@/features/auth';
import { AppProviders } from '@/providers/AppProviders';
import { activeClinicBlock, needsLocationSelection, useAuthStore } from '@/store/useAuthStore';

SplashScreen.preventAutoHideAsync();

/**
 * Route guards live here (the mobile twin of the web app's `__root.tsx`):
 * signed out → login · saved session but offline → offline · signed in without
 * a clinic/location (or a blocked clinic) → select-location · otherwise the app.
 *
 * The <Stack> must ALWAYS render (never return null while loading), or Expo
 * Router has no navigator to attach to and the screen stays blank. While the
 * session is restoring the native splash simply covers it.
 */
function RootNavigator() {
  const restore = useRestoreSession();
  const status = useAuthStore((s) => s.status);
  const mustSelect = useAuthStore(
    (s) => needsLocationSelection(s) || activeClinicBlock(s) !== null,
  );

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    if (status !== 'restoring') void SplashScreen.hideAsync();
  }, [status]);

  const signedIn = status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* "/" decides where to go; always available. */}
      <Stack.Screen name="index" />
      <Stack.Protected guard={status === 'unreachable'}>
        <Stack.Screen name="offline" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut' || status === 'restoring'}>
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
