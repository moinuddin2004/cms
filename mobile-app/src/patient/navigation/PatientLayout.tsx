import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { markReady } from '@/core/splash';

/**
 * The patient space's layout (docs/02 §4). It is a placeholder until M2-06
 * adds its providers, guards, sign-in and session restore; for now it is a
 * single "coming soon" page so the space can be picked and left again.
 */
export function PatientLayout() {
  useEffect(() => {
    markReady();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
