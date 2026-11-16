import type { QueryClient } from '@tanstack/react-query';

import { usePendingClaimStore } from '@/core/claim/usePendingClaimStore';
import { leaveSpaceAfterSignOut } from '@/core/space/switch-space';
import { beginPatientSignOut, dropSession, endPatientSignOut } from '@/patient/lib/api';
import { wipePatientPersistedCache } from '@/patient/lib/persist-cache';

import { clearMedicationLocalState } from '@/patient/features/medications';

import { logout } from '../api/auth.api';

/**
 * Sign out of the patient space ONLY (docs/03 §2.5): revoke on the server
 * (best effort), drop the patient token, wipe the encrypted PATIENT cache and
 * its key, clear the patient query cache, then move to the staff space if it
 * still has a session (else the welcome picker). The staff session, token and
 * cache are never touched.
 *
 * Unregistering the push device joins here with M3-07.
 */
export async function signOutPatient(queryClient: QueryClient): Promise<void> {
  // Stops a refresh in flight from writing the session back, and waits for it so
  // the stored token is the newest one when we revoke it.
  await beginPatientSignOut();
  try {
    await logout();
  } catch {
    // offline or already expired — still sign out locally
  }
  await dropSession();
  endPatientSignOut();
  // The wipe seals the persister, so it must run BEFORE the in-memory clear.
  try {
    await wipePatientPersistedCache();
  } catch {
    // still sign out; the cache is keyed to this account and busts on next sign-in
  }
  await clearMedicationLocalState(); // reminders of this account must not keep ringing
  usePendingClaimStore.getState().clear(); // a claim token never outlives the account it was opened for
  await queryClient.cancelQueries();
  queryClient.clear();
  await leaveSpaceAfterSignOut('patient');
}
