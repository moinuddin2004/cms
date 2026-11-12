import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { env } from '@/core/env';
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

/**
 * Tells the API this is the native app: it then returns the refresh token in
 * the body and reads it from `x-refresh-token` (no cookies on mobile).
 */
const NATIVE_HEADERS = { 'x-client-type': 'mobile' } as const;

/** The staff space's axios client: staff JWT + org/location headers. */
export const staffApi = axios.create({
  baseURL: env.apiUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json', ...NATIVE_HEADERS },
});

// ==================== REQUEST: token + tenant context ====================
staffApi.interceptors.request.use((config) => {
  const s = useStaffAuthStore.getState();
  if (s.accessToken) config.headers.Authorization = `Bearer ${s.accessToken}`;
  if (s.activeOrganizationId) config.headers['x-organization-id'] = s.activeOrganizationId;
  if (s.activeLocationId) config.headers['x-location-id'] = s.activeLocationId;
  return config;
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
let refreshInFlight: Promise<SessionPayload | null> | null = null;

export function refreshSession(): Promise<SessionPayload | null> {
  // One refresh at a time: the server rotates the token on every call, so two
  // parallel refreshes would invalidate each other.
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<SessionPayload | null> {
  const stored = await getRefreshToken();
  if (!stored) return null;
  try {
    // A bare axios call: this must not go through the interceptors below.
    const res = await axios.post(
      `${env.apiUrl}/auth/refresh`,
      {},
      { headers: { ...NATIVE_HEADERS, 'x-refresh-token': stored }, timeout: 15_000 },
    );
    const payload = res.data.data as SessionPayload;
    await persistSession(payload);
    return payload;
  } catch (err) {
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

// ==================== RESPONSE: gate codes + auto-refresh ====================
type Retryable = InternalAxiosRequestConfig & { _retry?: boolean };

staffApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as Retryable | undefined;

    if (error.response?.status === 403) {
      const body = error.response.data as
        | { code?: unknown; message?: unknown; error?: { code?: unknown } | null }
        | undefined;
      // The API's exception filter nests the thrown object under `error`.
      const code = body?.code ?? body?.error?.code;
      const s = useStaffAuthStore.getState();
      if (code === 'EMAIL_NOT_VERIFIED') s.setEmailVerificationRequired(true);
      if (typeof code === 'string' && CLINIC_GATE_CODES.has(code)) {
        if (s.activeOrganizationId && !s.isSuperAdmin) {
          s.setClinicBlock(s.activeOrganizationId, {
            code: code as SignInBlockCode,
            message: typeof body?.message === 'string' ? body.message : '',
          });
        }
      }
    }

    if (error.response?.status !== 401 || !original) return Promise.reject(error);

    const url = original.url ?? '';
    if (url.includes('/auth/refresh') || url.includes('/auth/login') || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    let session: SessionPayload | null;
    try {
      session = await refreshSession();
    } catch {
      return Promise.reject(error); // offline: keep the session, let the caller retry
    }
    if (!session) return Promise.reject(error); // refreshSession already signed out

    original.headers.Authorization = `Bearer ${session.accessToken}`;
    return staffApi(original);
  },
);
