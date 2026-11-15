import { REFRESH_TOKEN_KEYS } from '@/core/space/session-keys';
import { createSecureItem } from '@/core/storage/secure-store';

/**
 * The staff refresh token (`sessionId:token`) lives ONLY in the device
 * keychain / keystore. The access token is never persisted — it stays in
 * memory (`useStaffAuthStore`) and is re-issued from this on app start.
 *
 * The key is unchanged (`auth.refreshToken`), so sessions from before the
 * core/staff split keep working.
 */
const refreshToken = createSecureItem(REFRESH_TOKEN_KEYS.staff);

export const getRefreshToken = refreshToken.get;
export const setRefreshToken = refreshToken.set;
export const clearRefreshToken = refreshToken.clear;
