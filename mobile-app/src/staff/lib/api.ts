import axios, { AxiosError } from 'axios';

import { env } from '@/core/env';
import { READ_ONLY_OFFLINE } from '@/core/http/api-error';
import {
  API_TIMEOUT_MS,
  NATIVE_HEADERS,
  createApiClient,
  createRefreshCoordinator,
  type RefreshGuard,
} from '@/core/http/create-api-client';
import { wipeStaffPersistedCache } from '@/staff/lib/persist-cache';
import { clearRefreshToken, getRefreshToken, setRefreshToken } from '@/staff/lib/session';
import {
  useStaffAuthStore,
  type SessionPayload,
  type SignInBlockCode,
} from '@/staff/store/useStaffAuthStore';

/** 403 codes from the backend ClinicGate (approval + sign-in policy). */
const CLINIC_GATE_CODES = new Set<string>([
  'CLINIC_PENDING_APPROVAL',
  'CLINIC_REJECTED',
  'GOOGLE_SIGN_IN_REQUIRED',
  'GOOGLE_SIGN_IN_DISABLED',
  'GOOGLE_DOMAIN_NOT_ALLOWED',
]);

/** The staff space's axios client: staff JWT + org/location headers. */
export const staffApi = createApiClient({
  onRequest: (config) => {
    const s = useStaffAuthStore.getState();
    if (s.accessToken) config.headers.Authorization = `Bearer ${s.accessToken}`;
    if (s.activeOrganizationId) config.headers['x-organization-id'] = s.activeOrganizationId;
    if (s.activeLocationId) config.headers['x-location-id'] = s.activeLocationId;
    // Opened on saved data (M1-06b): read-only. Throwing here rejects before anything is sent;
    // the distinct code is never retried (see `isRetryable`).
    if (s.offlineSnapshot && (config.method ?? 'get').toLowerCase() !== 'get') {
      throw new AxiosError('Saved data is read-only', READ_ONLY_OFFLINE, config);
    }
  },
  // Lazy: `refreshSession` is declared below.
  refreshSession: () => refreshSession(),
  noRefreshUrls: ['/auth/refresh', '/auth/login', '/auth/google'],
  onForbidden: (error, code) => {
    const body = error.response?.data as { message?: unknown } | undefined;
    const s = useStaffAuthStore.getState();
    if (code === 'EMAIL_NOT_VERIFIED') s.setEmailVerificationRequired(true);
    if (code && CLINIC_GATE_CODES.has(code)) {
      if (s.activeOrganizationId && !s.isSuperAdmin) {
        s.setClinicBlock(s.activeOrganizationId, {
          code: code as SignInBlockCode,
          message: typeof body?.message === 'string' ? body.message : '',
        });
      }
    }
  },
});

// ==================== SESSION STORAGE ====================

/** Save a login / refresh payload: memory for the access token, keychain for the refresh token. */
export async function persistSession(payload: SessionPayload): Promise<void> {
  if (payload.refreshToken) await setRefreshToken(payload.refreshToken);
  useStaffAuthStore.getState().setSession(payload);
}

/** Forget the session on this device (does not call the API). */
export async function dropSession(): Promise<void> {
  await clearRefreshToken();
  useStaffAuthStore.getState().clearAuth();
}

/**
 * Exchange the stored refresh token for a new session. Returns null when
 * there is none or the server rejected it. Throws on a network failure, so
 * callers can tell "signed out" from "offline".
 */
// One refresh at a time: the server rotates the token on every call, so two
// parallel refreshes would invalidate each other.
const refreshCoordinator = createRefreshCoordinator<SessionPayload>(doRefresh);
export const refreshSession = refreshCoordinator.refresh;

/**
 * Sign-out protocol (M2-06 rework): `await beginStaffSignOut()` BEFORE the
 * server logout (it waits for a refresh in flight and makes its result stale),
 * then drop the session, then `endStaffSignOut()`. Without it a refresh that
 * finishes after the sign-out would write the session back.
 */
export const beginStaffSignOut = refreshCoordinator.beginSignOut;
export const endStaffSignOut = refreshCoordinator.endSignOut;

/** Revoke a freshly rotated token that a stale refresh must not keep (best effort). */
async function revokeDiscarded(token: string | undefined): Promise<void> {
  if (!token) return;
  try {
    await axios.post(
      `${env.apiUrl}/auth/logout`,
      {},
      { headers: { ...NATIVE_HEADERS, 'x-refresh-token': token }, timeout: API_TIMEOUT_MS },
    );
  } catch {
    // the session expires on its own
  }
}

async function doRefresh(guard: RefreshGuard): Promise<SessionPayload | null> {
  const stored = await getRefreshToken();
  if (!stored) return null;
  try {
    // A bare axios call: this must not go through the interceptors below.
    const res = await axios.post(
      `${env.apiUrl}/auth/refresh`,
      {},
      { headers: { ...NATIVE_HEADERS, 'x-refresh-token': stored }, timeout: API_TIMEOUT_MS },
    );
    const payload = res.data.data as SessionPayload;
    if (!guard.isCurrent()) {
      // Signed out while this was in flight: keep nothing, revoke the new token.
      await revokeDiscarded(payload.refreshToken);
      return null;
    }
    await persistSession(payload);
    return payload;
  } catch (err) {
    if (!guard.isCurrent()) return null;
    const status = (err as AxiosError).response?.status;
    // 401/403 = the session is gone. Anything else (no response, 5xx) = try later.
    if (status === 401 || status === 403) {
      // Forced sign-out: the encrypted offline cache goes with the session.
      try {
        await wipeStaffPersistedCache();
      } catch {
        // still drop the session; the cache is keyed to this user and busts on next login
      }
      await dropSession();
      return null;
    }
    throw err;
  }
}
