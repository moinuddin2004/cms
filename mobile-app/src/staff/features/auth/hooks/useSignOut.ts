import { useMutation, useQueryClient } from '@tanstack/react-query';

import { switchSpace } from '@/core/space/switch-space';
import { dropSession } from '@/staff/lib/api';

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
      queryClient.clear();
      // The patient space does not exist yet, so signing out always returns to
      // the welcome picker (docs/02 §4; M2-06 switches to the other space when
      // it is signed in).
      switchSpace(null);
    },
  });
}
