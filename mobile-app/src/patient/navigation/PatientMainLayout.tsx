import { Redirect, Stack } from 'expo-router';

import { ReminderSync } from '@/patient/features/medications';
import { freshPendingToken, usePendingClaimStore } from '@/core/claim/usePendingClaimStore';
import { PatientPushRegistration, PatientPushRoute } from '@/patient/features/devices';
import { PatientRealtimeProvider } from '@/patient/lib/realtime-provider';

/**
 * The signed-in patient stack: realtime socket (M3-06), push registration and tap
 * routing (M3-07). A claim token that arrived before sign-in (docs/06 P-01) is
 * resumed here: the patient lands on the confirm page, which clears the token
 * when it is done. The `<Stack>` always renders.
 */
export function PatientMainLayout() {
  const hasPendingClaim = usePendingClaimStore((s) => freshPendingToken(s) !== null);

  return (
    <PatientRealtimeProvider>
      <ReminderSync />
      <Stack screenOptions={{ headerShown: false }} />
      <PatientPushRegistration />
      <PatientPushRoute />
      {hasPendingClaim ? <Redirect href="/claim/confirm" /> : null}
    </PatientRealtimeProvider>
  );
}
