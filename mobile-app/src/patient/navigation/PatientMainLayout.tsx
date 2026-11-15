import { Redirect, Stack } from 'expo-router';

import { usePendingClaimStore } from '@/core/claim/usePendingClaimStore';

/**
 * The signed-in patient stack. Tabs, realtime and push registration join in
 * later cards. A claim token that arrived before sign-in (docs/06 P-01) is
 * resumed here: the patient lands on the confirm page, which clears the token
 * when it is done. The `<Stack>` always renders.
 */
export function PatientMainLayout() {
  const hasPendingClaim = usePendingClaimStore((s) => s.token !== null);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {hasPendingClaim ? <Redirect href="/claim/confirm" /> : null}
    </>
  );
}
