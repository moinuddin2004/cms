import { useCallback } from 'react';

import { refreshSession } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Silently sign in again with the refresh token in SecureStore.
 * No token or a rejected one → signed out. No connection → `unreachable`,
 * so the user keeps their session and can retry instead of being logged out.
 */
export function useRestoreSession() {
  const setStatus = useAuthStore((s) => s.setStatus);

  return useCallback(async () => {
    setStatus('restoring');
    try {
      const session = await refreshSession();
      // On success refreshSession already stored it; on rejection it signed out.
      if (!session) setStatus('signedOut');
    } catch {
      setStatus('unreachable');
    }
  }, [setStatus]);
}
