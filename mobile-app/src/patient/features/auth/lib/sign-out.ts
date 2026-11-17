import type { QueryClient } from '@tanstack/react-query';

import { leaveSpaceAfterSignOut } from '@/core/space/switch-space';
import { clearPatientEvents } from '@/patient/lib/analytics';
import { beginPatientSignOut, dropSession, endPatientSignOut } from '@/patient/lib/api';
import { wipePatientLocalState } from '@/patient/lib/wipe-local-state';
import { unregisterThisDevice } from '@/patient/features/devices/lib/device-registration';

import { logout } from '../api/auth.api';

/**
 * Sign out of the patient space ONLY (docs/03 §2.5): revoke on the server
 * (best effort), drop the patient token, wipe the encrypted PATIENT cache and
 * its key, clear the patient query cache, then move to the staff space if it
 * still has a session (else the welcome picker). The staff session, token and
 * cache are never touched.
 *
 * The push device is unregistered first (M3-07).
 */
export async function signOutPatient(queryClient: QueryClient): Promise<void> {
  // Stops a refresh in flight from writing the session back, and waits for it so
  // the stored token is the newest one when we revoke it.
  clearPatientEvents(); // nothing queued for this account may be sent while we sign out
  await beginPatientSignOut();
  // Stop pushes to this phone while the token still works (short timeout, best effort).
  await unregisterThisDevice();
  try {
    await logout();
  } catch {
    // offline or already expired — still sign out locally
  }
  await dropSession();
  endPatientSignOut();
  await wipePatientLocalState(queryClient);
  await leaveSpaceAfterSignOut('patient');
}
