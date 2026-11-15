import axios, { type AxiosError } from 'axios';

import { env } from '@/core/env';
import {
  API_TIMEOUT_MS,
  NATIVE_HEADERS,
  createApiClient,
  createRefreshCoordinator,
  type RefreshGuard,
} from '@/core/http/create-api-client';
import { wipePatientPersistedCache } from '@/patient/lib/persist-cache';
import { patientQueryClient } from '@/patient/lib/query-client';
import { clearRefreshToken, getRefreshToken, setRefreshToken } from '@/patient/lib/session';
import {
  usePatientAuthStore,
  type PatientSessionPayload,
} from '@/patient/store/usePatientAuthStore';

/**
 * The patient space's axios client: patient JWT only. There is deliberately NO
 * code path here that sets `x-organization-id` / `x-location-id` (docs/03 §2.3).
 */
export const patientApi = createApiClient({
  onRequest: (config) => {
    const token = usePatientAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  },
  refreshSession: () => refreshSession(),
  // Pre-login endpoints (sign-in, refresh, logout) never trigger a refresh.
  noRefreshUrls: ['/patient-auth/'],
  onForbidden: (_error: AxiosError, code) => {
    if (code === 'ACCOUNT_DISABLED') void forceSignOut();
    // A link was frozen / its clinic switched the app off (revoked links answer 404): link data is stale.
    if (code === 'PATIENT_APP_DISABLED') void patientQueryClient.invalidateQueries({ queryKey: ['links'] });
  },
});

// ==================== SESSION STORAGE ====================

/** Save a sign-in / refresh payload: memory for the access token, keychain for the refresh token. */
export async function persistSession(payload: PatientSessionPayload): Promise<void> {
  await setRefreshToken(payload.refreshToken);
  usePatientAuthStore.getState().setSession(payload);
}

/** Forget the session on this device (does not call the API). */
export async function dropSession(): Promise<void> {
  await clearRefreshToken();
  usePatientAuthStore.getState().clearAuth();
}

/** The session is gone (server said so): the encrypted patient cache goes with it. */
async function forceSignOut(): Promise<void> {
  try {
    await wipePatientPersistedCache();
  } catch {
    // still drop the session; the cache is keyed to this account and busts on next sign-in
  }
  patientQueryClient.clear();
  await dropSession();
}

/**
 * Exchange the stored refresh token for a new session. Returns null when there
 * is none or the server rejected it. Throws on a network failure, so callers can
 * tell "signed out" from "offline".
 *
 * SINGLE-FLIGHT, and every caller (restore, the 401 interceptor) goes through
 * it: the backend rotates the refresh token on each call and treats a replayed
 * old one as theft — it revokes the whole session (M2-02 review #8). Never
 * retry this call with the same stored token on your own.
 */
const refreshCoordinator = createRefreshCoordinator<PatientSessionPayload>(doRefresh);
export const refreshSession = refreshCoordinator.refresh;

/**
 * Sign-out protocol (M2-06 rework): `await beginPatientSignOut()` BEFORE the
 * server logout (it waits for a refresh in flight and makes its result stale),
 * then drop the session, then `endPatientSignOut()`. Without it a refresh that
 * finishes after the sign-out would write the session back.
 */
export const beginPatientSignOut = refreshCoordinator.beginSignOut;
export const endPatientSignOut = refreshCoordinator.endSignOut;

/** Revoke a freshly rotated token that a stale refresh must not keep (best effort). */
async function revokeDiscarded(token: string): Promise<void> {
  try {
    await axios.post(
      `${env.apiUrl}/patient-auth/logout`,
      {},
      {
        headers: { ...NATIVE_HEADERS, 'x-patient-refresh-token': token },
        timeout: API_TIMEOUT_MS,
      },
    );
  } catch {
    // the session expires on its own
  }
}

async function doRefresh(guard: RefreshGuard): Promise<PatientSessionPayload | null> {
  const stored = await getRefreshToken();
  if (!stored) return null;
  try {
    // A bare axios call: this must not go through the interceptors above.
    const res = await axios.post(
      `${env.apiUrl}/patient-auth/refresh`,
      {},
      {
        headers: { ...NATIVE_HEADERS, 'x-patient-refresh-token': stored },
        timeout: API_TIMEOUT_MS,
      },
    );
    const payload = res.data.data as PatientSessionPayload;
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
      await forceSignOut();
      return null;
    }
    throw err;
  }
}
