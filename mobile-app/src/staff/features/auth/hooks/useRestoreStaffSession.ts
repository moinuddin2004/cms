import { isAxiosError } from 'axios';
import { useCallback } from 'react';

import { refreshSession } from '@/staff/lib/api';
import { loadOfflineHint } from '@/staff/lib/offline-hint';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

/** No response at all: offline, DNS, timeout. */
const isNetworkError = (err: unknown) => isAxiosError(err) && !err.response;

/**
 * Silently sign in again with the refresh token in SecureStore.
 * No token or a rejected one → signed out. No connection → `unreachable`,
 * so the user keeps their session and can retry instead of being logged out.
 */
export function useRestoreStaffSession() {
  const setStatus = useStaffAuthStore((s) => s.setStatus);
  const setOfflineHint = useStaffAuthStore((s) => s.setOfflineHint);

  return useCallback(async () => {
    setStatus('restoring');
    setOfflineHint(null);
    try {
      const session = await refreshSession();
      // On success refreshSession already stored it; on rejection it signed out.
      if (!session) setStatus('signedOut');
    } catch (err) {
      // "Open saved data" is offered only when the phone could not reach the server at all
      // (no response). A 5xx is a server problem, and 401/403 never gets here (signed out).
      if (isNetworkError(err)) setOfflineHint(await loadOfflineHint());
      setStatus('unreachable');
    }
  }, [setStatus, setOfflineHint]);
}
