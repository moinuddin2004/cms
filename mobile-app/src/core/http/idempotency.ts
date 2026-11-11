/**
 * Idempotency helpers (docs/04 §8, docs/07 §2.3). Same behaviour as the web's
 * retry loop in `queue.api.ts`: retry only on a network error or
 * `503 LOCK_TIMEOUT`, never on a 4xx.
 */
import { isAxiosError, isCancel } from 'axios';
import { randomUUID } from 'expo-crypto';

export const MAX_RETRIES = 3;

export function newIdempotencyKey(): string {
  return randomUUID();
}

export function isRetryable(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  if (isCancel(err)) return false;
  if (!err.response) return true;
  const data = err.response.data as { error?: { code?: unknown } } | undefined;
  return err.response.status === 503 && data?.error?.code === 'LOCK_TIMEOUT';
}

/** 250 ms × (attempt + 1) + 0–100 ms jitter. `attempt` is 0 for the first retry. */
export function retryDelayMs(attempt: number): number {
  return 250 * (attempt + 1) + Math.floor(Math.random() * 101);
}
