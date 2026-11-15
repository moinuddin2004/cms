import { useMutation, useQueryClient } from '@tanstack/react-query';

import { leaveSpaceAfterSignOut } from '@/core/space/switch-space';
import { unregisterThisDevice } from '@/staff/features/devices';
import { beginStaffSignOut, dropSession, endStaffSignOut } from '@/staff/lib/api';
import { wipeStaffPersistedCache } from '@/staff/lib/persist-cache';

import { logout } from '../api/auth.api';

/** Sign out: revoke on the server (best effort), then always clear the device and the cache. */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Stops a refresh in flight from writing the session back, and waits for it
      // so the stored token is the newest one when we revoke it.
      await beginStaffSignOut();
      // Stop pushes to this phone while the access token is still valid (short, skipped offline).
      await unregisterThisDevice();
      try {
        await logout();
      } catch {
        // offline or already expired â€” still sign out locally
      }
      await dropSession();
      endStaffSignOut();
      // Encrypted offline cache first (persisted client + file + key, docs/03 §2.5):
      // it also stops late writes, so clearing the in-memory cache cannot re-save it.
      try {
        await wipeStaffPersistedCache();
      } catch {
        // still sign out; the cache is keyed to this user and busts on next login
      }
      queryClient.clear();
      // Back to the patient space if it still has a session, else the welcome
      // picker (docs/02 4). The patient session and cache are never touched.
      await leaveSpaceAfterSignOut('staff');
    },
  });
}
