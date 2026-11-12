import { useMutation, useQueryClient } from '@tanstack/react-query';

import { switchSpace } from '@/core/space/switch-space';
import { dropSession } from '@/staff/lib/api';
import { wipeStaffPersistedCache } from '@/staff/lib/persist-cache';

import { logout } from '../api/auth.api';

/** Sign out: revoke on the server (best effort), then always clear the device and the cache. */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await logout();
      } catch {
        // offline or already expired — still sign out locally
      }
      await dropSession();
      // Encrypted offline cache first (persisted client + file + key, docs/03 �2.5):
      // it also stops late writes, so clearing the in-memory cache cannot re-save it.
      try {
        await wipeStaffPersistedCache();
      } catch {
        // still sign out; the cache is keyed to this user and busts on next login
      }
      queryClient.clear();
      // The patient space does not exist yet, so signing out always returns to
      // the welcome picker (docs/02 §4; M2-06 switches to the other space when
      // it is signed in).
      switchSpace(null);
    },
  });
}
