import type { QueryClient } from '@tanstack/react-query';

import { usePendingClaimStore } from '@/core/claim/usePendingClaimStore';
// The store file directly, not the devices barrel: the barrel exports screens (expo-router, keyboard
// controller) that sign-out must not drag in.
import { usePatientPushRouteStore } from '@/patient/features/devices/store/usePatientPushRouteStore';
import { clearMedicationLocalState } from '@/patient/features/medications';
import { clearPatientEvents } from '@/patient/lib/analytics';
import { registerForcedSignOutWipe } from '@/patient/lib/api';
import { wipePatientPersistedCache } from '@/patient/lib/persist-cache';
import { patientQueryClient } from '@/patient/lib/query-client';

/**
 * Everything the patient space keeps on this phone for the account that is leaving. ONE function for
 * BOTH the voluntary sign-out and the forced one (the server revoked the session / disabled the
 * account), so the two can never drift apart (audit H1/L17):
 *  - queued analytics events (never sent under the next account's token)
 *  - the encrypted patient cache and the persisted query client (the persister is sealed first)
 *  - medicine reminders (a lost phone must stop printing medicine names) + the unsent dose queue
 *  - a pending claim token and a pending push tap
 *  - the in-memory query cache
 * The session itself (`dropSession`) is dropped by the caller. Each step is best effort: one failure
 * never stops the rest.
 */
export async function wipePatientLocalState(queryClient: QueryClient): Promise<void> {
  const steps: Array<() => void | Promise<void>> = [
    () => clearPatientEvents(),
    // The wipe seals the persister, so it must run BEFORE the in-memory clear.
    () => wipePatientPersistedCache(),
    () => clearMedicationLocalState(),
    () => usePendingClaimStore.getState().clear(), // a claim token never outlives its account
    () => usePatientPushRouteStore.getState().clear(),
    async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
    },
  ];
  for (const step of steps) {
    try {
      await step();
    } catch {
      // keep going: the cache is keyed to the account and busts on the next sign-in
    }
  }
}

// The server-forced sign-out (revoked session, disabled account) runs the SAME wipe.
registerForcedSignOutWipe(() => wipePatientLocalState(patientQueryClient));
