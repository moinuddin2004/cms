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
