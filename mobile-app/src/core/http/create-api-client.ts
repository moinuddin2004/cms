import {
  create as createAxios,
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '@/core/env';

/**
 * Tells the API this is the native app: it then returns the refresh token in
 * the body and reads it from a header (no cookies on mobile).
 */
export const NATIVE_HEADERS = { 'x-client-type': 'mobile' } as const;

export const API_TIMEOUT_MS = 15_000;

/**
 * Wraps an async function so that concurrent callers share ONE in-flight call.
 * Used for token refresh: the server rotates the refresh token on every call
 * (and a replayed old one is treated as theft), so two parallel refreshes would
 * invalidate each other or sign the user out.
 */
export function createSingleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    inFlight ??= fn().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}

/** The API's error code. The exception filter nests the thrown object under `error`. */
export function extractErrorCode(error: unknown): string | undefined {
  const body = (error as AxiosError | undefined)?.response?.data as
    | { code?: unknown; error?: { code?: unknown } | null }
    | undefined;
  const code = body?.code ?? body?.error?.code;
  return typeof code === 'string' ? code : undefined;
}

export interface ApiClientOptions {
  /** Defaults to `env.apiUrl`. */
  baseURL?: string;
  /** Extra headers sent on every request (the native header is always included). */
  headers?: Record<string, string>;
  /** Called for every request: attach the auth header (and, for staff only, tenant headers). */
  onRequest: (config: InternalAxiosRequestConfig) => void;
  /**
   * Exchange the stored refresh token for a new access token. `null` = the
   * session is gone (the callee already signed out). Throws when offline.
   * MUST be single-flight (`createSingleFlight`).
   */
  refreshSession: () => Promise<{ accessToken: string } | null>;
  /** 401s on URLs containing any of these never trigger a refresh (login / refresh endpoints). */
  noRefreshUrls: string[];
  /** Called for every 403 response (gate codes etc.). */
  onForbidden?: (error: AxiosError, code: string | undefined) => void;
}

type Retryable = InternalAxiosRequestConfig & { _retry?: boolean };

/**
 * Builds a space's axios client. Each space creates exactly one (docs/02 §5);
 * what differs between them (auth header, tenant headers, refresh endpoint,
 * 403 codes) is injected, the 401 → single refresh → retry-once flow is shared.
 */
export function createApiClient(options: ApiClientOptions): AxiosInstance {
  const client = createAxios({
    baseURL: options.baseURL ?? env.apiUrl,
    timeout: API_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json', ...NATIVE_HEADERS, ...options.headers },
  });

  client.interceptors.request.use((config) => {
    options.onRequest(config);
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const original = error.config as Retryable | undefined;

      if (error.response?.status === 403) options.onForbidden?.(error, extractErrorCode(error));

      if (error.response?.status !== 401 || !original) return Promise.reject(error);

      const url = original.url ?? '';
      if (options.noRefreshUrls.some((part) => url.includes(part)) || original._retry) {
        return Promise.reject(error);
      }
      original._retry = true;

      let session: { accessToken: string } | null;
      try {
        session = await options.refreshSession();
      } catch {
        return Promise.reject(error); // offline: keep the session, let the caller retry
      }
      if (!session) return Promise.reject(error); // refreshSession already signed out

      original.headers.Authorization = `Bearer ${session.accessToken}`;
      return client(original);
    },
  );

  return client;
}

export interface RefreshGuard {
  /** False once a sign-out started after this refresh began: its result must be discarded. */
  isCurrent: () => boolean;
}

export interface RefreshCoordinator<T> {
  /** Single-flight refresh (shared by restore and the 401 interceptor). */
  refresh: () => Promise<T | null>;
  /**
   * Call FIRST when signing out: invalidates every refresh already running or
   * about to start, then waits for the running one to finish, so nothing can
   * write a session back after the sign-out and the stored refresh token is the
   * newest one when you revoke it.
   */
  beginSignOut: () => Promise<void>;
  /** Call after the local session is dropped: refreshes that started in between are stale too. */
  endSignOut: () => void;
}

/**
 * Per-space refresh with a session generation. `run` receives a guard and MUST
 * check `guard.isCurrent()` after the network call and BEFORE storing anything;
 * when stale it discards the result (and revokes the freshly rotated token).
 */
export function createRefreshCoordinator<T>(
  run: (guard: RefreshGuard) => Promise<T | null>,
): RefreshCoordinator<T> {
  let generation = 0;
  let signingOut = false;
  const refresh = createSingleFlight(() => {
    const started = generation;
    return run({ isCurrent: () => generation === started && !signingOut });
  });
  let inFlight: Promise<unknown> | null = null;
  const tracked = () => {
    const p = refresh();
    inFlight = p;
    void p.then(
      () => {
        if (inFlight === p) inFlight = null;
      },
      () => {
        if (inFlight === p) inFlight = null;
      },
    );
    return p;
  };
  return {
    refresh: tracked,
    beginSignOut: async () => {
      generation += 1;
      signingOut = true;
      try {
        await inFlight;
      } catch {
        // a failed refresh is fine: we are signing out anyway
      }
    },
    endSignOut: () => {
      generation += 1;
      signingOut = false;
    },
  };
}
