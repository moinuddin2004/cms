import { useCallback } from 'react';

import { refreshSession } from '@/patient/lib/api';
import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

/**
 * Silently sign in again with the refresh token in SecureStore.
 * No token or a rejected one → signed out. No connection → `unreachable`, so
 * the user keeps their session and can retry instead of being logged out.
 *
 * Already signed in (the user switched away from this space and back) → does
 * nothing: re-running it would rotate the refresh token for no reason.
 * Concurrent calls (StrictMode, a 401 racing the restore) share one refresh —
 * see `refreshSession`.
 */
export function useRestorePatientSession() {
  const setStatus = usePatientAuthStore((s) => s.setStatus);

  return useCallback(async () => {
    if (usePatientAuthStore.getState().status === 'signedIn') return;
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
