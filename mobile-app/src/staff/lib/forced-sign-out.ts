import { clearThemeCache } from '@/staff/features/theme';
import { clearStaffEvents } from '@/staff/lib/analytics';
import { registerForcedSignOutCleanup } from '@/staff/lib/api';
import { staffQueryClient } from '@/staff/lib/query-client';

/**
 * What a forced staff sign-out (refresh rejected) must clear besides the session and the encrypted
 * cache, mirroring the voluntary `useSignOut` (audit M1, L16, L17, M4): the in-memory query cache
 * (gcTime 24 h — the next user on a shared tablet must not see it), queued analytics events (they
 * would be sent under the next user's token) and the theme cache. The push token stays in the
 * keychain: the access token is already dead, so `PendingDeviceCleanup` unregisters it on the
 * next start through the session-less endpoint.
 */
export async function forcedSignOutCleanup(): Promise<void> {
  clearStaffEvents();
  clearThemeCache();
  await staffQueryClient.cancelQueries();
  staffQueryClient.clear();
}

registerForcedSignOutCleanup(forcedSignOutCleanup);
