import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { markReady } from '@/core/splash';
import { applyTextScale } from '@/core/theme/apply-text-scale';
import { useRestorePatientSession } from '@/patient/features/auth';
import { PatientProviders } from '@/patient/providers/PatientProviders';
import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

import { resolvePatientRoute } from './resolve-patient-route';

/**
 * The patient space's layout (docs/02 §4): its own providers + query cache, its
 * own session restore and the offline / sign-in / verify-code / name / main
 * guards. Mounted only while the patient space is active.
 *
 * The `<Stack>` always renders — returning `null` during restore would leave
 * Expo Router without a navigator. The root splash covers the restoring frame.
 * The larger patient text scale is applied on mount (docs/05 §3) and reset when
 * the space unmounts.
 */
export function PatientLayout() {
  const restore = useRestorePatientSession();
  const status = usePatientAuthStore((s) => s.status);
  const awaitingCode = usePatientAuthStore((s) => s.pendingEmail !== null);
  const needsName = usePatientAuthStore((s) => s.needsName);

  useEffect(() => {
    // Skips itself when already signed in (the user is coming back from the staff space).
    void restore();
  }, [restore]);

  useEffect(() => {
    applyTextScale('patient');
    return () => applyTextScale('staff');
  }, []);

  const [cacheSettled, setCacheSettled] = useState(false);
  const onCacheSettled = useCallback(() => setCacheSettled(true), []);

  useEffect(() => {
    // The splash stays up until the session is restored and the cache is open (or failed to).
    if (status !== 'restoring' && cacheSettled) markReady();
  }, [status, cacheSettled]);

  const route = resolvePatientRoute({ status, awaitingCode, needsName });

  return (
    <PatientProviders onCacheSettled={onCacheSettled}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={route === 'offline'}>
          <Stack.Screen name="offline" />
        </Stack.Protected>
        <Stack.Protected guard={route === 'sign-in'}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={route === 'verify-code'}>
          <Stack.Screen name="verify-code" />
        </Stack.Protected>
        <Stack.Protected guard={route === 'name'}>
          <Stack.Screen name="name" />
        </Stack.Protected>
        <Stack.Protected guard={route === 'main'}>
          <Stack.Screen name="(main)" />
        </Stack.Protected>
      </Stack>
    </PatientProviders>
  );
}
