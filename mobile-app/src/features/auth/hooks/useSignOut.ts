import { useMutation, useQueryClient } from '@tanstack/react-query';

import { dropSession } from '@/lib/api';

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
    },
  });
}
