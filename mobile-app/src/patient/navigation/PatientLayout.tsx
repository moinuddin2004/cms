import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { markReady } from '@/core/splash';
import { applyTextScale } from '@/core/theme/apply-text-scale';

/**
 * The patient space's layout (docs/02 §4). It is a placeholder until M2-06
 * adds its providers, guards, sign-in and session restore; for now it is a
 * single "coming soon" page so the space can be picked and left again.
 *
 * The larger patient text scale is applied on mount (docs/05 §3, M0-05 step 6)
 * and reset when the space unmounts.
 */
export function PatientLayout() {
  useEffect(() => {
    applyTextScale('patient');
    markReady();
    return () => applyTextScale('staff');
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
