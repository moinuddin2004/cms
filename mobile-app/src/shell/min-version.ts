import { env } from '@/core/env';

/**
 * `GET /app/min-version` (docs/07 §4.3), fetched once per cold start by the
 * root shell. Public endpoint: no token, no tenant headers.
 *
 * The gate fails **open**: any network/parse problem returns `null` and the app
 * keeps working. A old build must never be locked out because the server was
 * unreachable.
 */
export interface AppMinVersion {
  android: string;
  ios: string;
  message?: string;
}

const TIMEOUT_MS = 6_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Reads the version floors from the backend's `ResponseWrapper` body. Accepts
 * an unwrapped payload too, so the app keeps working if the envelope is ever
 * simplified. Malformed data counts as "cannot check" (fail open).
 */
export function parseMinVersion(payload: unknown): AppMinVersion | null {
  if (!isRecord(payload)) return null;

  // Every API response is wrapped in { data, message, isSuccess, … }.
  const candidate = isRecord(payload.data) ? payload.data : payload;
  const { android, ios, message } = candidate;

  if (typeof android !== 'string' || typeof ios !== 'string') return null;

  return typeof message === 'string' && message.trim()
    ? { android, ios, message: message.trim() }
    : { android, ios };
}

/** Returns the server's version floors, or `null` when they cannot be checked. */
export async function fetchMinVersion(): Promise<AppMinVersion | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${env.apiUrl}/app/min-version`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return parseMinVersion(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
