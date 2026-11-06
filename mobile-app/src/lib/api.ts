import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { env } from '@/lib/env';
import { clearRefreshToken, getRefreshToken, setRefreshToken } from '@/lib/secure-storage';
import {
  useAuthStore,
  type SessionPayload,
  type SignInBlockCode,
} from '@/store/useAuthStore';

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

export const api = axios.create({
  baseURL: env.apiUrl,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json', ...NATIVE_HEADERS },
});

// ==================== REQUEST: token + tenant context ====================
api.interceptors.request.use((config) => {
  const s = useAuthStore.getState();
  if (s.accessToken) config.headers.Authorization = `Bearer ${s.accessToken}`;
  if (s.activeOrganizationId) config.headers['x-organization-id'] = s.activeOrganizationId;
  if (s.activeLocationId) config.headers['x-location-id'] = s.activeLocationId;
  return config;
});

// ==================== SESSION STORAGE ====================

/** Save a login / refresh payload: memory for the access token, keychain for the refresh token. */
export async function persistSession(payload: SessionPayload): Promise<void> {
  if (payload.refreshToken) await setRefreshToken(payload.refreshToken);
  useAuthStore.getState().setSession(payload);
}

/** Forget the session on this device (does not call the API). */
export async function dropSession(): Promise<void> {
  await clearRefreshToken();
  useAuthStore.getState().clearAuth();
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
      await dropSession();
      return null;
    }
    throw err;
  }
}

// ==================== RESPONSE: gate codes + auto-refresh ====================
type Retryable = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as Retryable | undefined;

    if (error.response?.status === 403) {
      const body = error.response.data as
        | { code?: unknown; message?: unknown; error?: { code?: unknown } | null }
        | undefined;
      // The API's exception filter nests the thrown object under `error`.
      const code = body?.code ?? body?.error?.code;
      const s = useAuthStore.getState();
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
    return api(original);
  },
);

/** Axios error → the API's message (first one for validation arrays). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && !err.response) {
    return 'No connection. Check your internet and try again.';
  }
  const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(msg)) return String(msg[0]);
  return typeof msg === 'string' && msg ? msg : fallback;
}

