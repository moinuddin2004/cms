import { REFRESH_TOKEN_KEYS } from '@/core/space/session-keys';
import { createSecureItem } from '@/core/storage/secure-store';

/**
 * The patient refresh token (`sessionId:token`) lives ONLY in the device
 * keychain / keystore (`patient.refreshToken`, docs/03 §2.1). The access token
 * stays in memory (`usePatientAuthStore`).
 */
const refreshToken = createSecureItem(REFRESH_TOKEN_KEYS.patient);

export const getRefreshToken = refreshToken.get;
export const setRefreshToken = refreshToken.set;
export const clearRefreshToken = refreshToken.clear;
