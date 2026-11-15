/** The claim token's lifetime (docs/07 §4.1); the fallback when the server gave no usable time. */
export const CLAIM_TTL_MS = 15 * 60 * 1000;

/**
 * The phone-clock moment the code runs out, so a wrong device clock cannot skew
 * the countdown: remaining time = `expiresAt` minus the SERVER's time (its `Date`
 * response header), counted from the moment the response arrived. Without a
 * usable header it falls back to the full 15-minute lifetime.
 */
export function deadlineFromResponse(
  expiresAt: string,
  serverDateHeader: string | undefined,
  receivedAt: number,
): number {
  const expires = Date.parse(expiresAt);
  const serverNow = serverDateHeader ? Date.parse(serverDateHeader) : NaN;
  const remaining =
    Number.isNaN(expires) || Number.isNaN(serverNow)
      ? CLAIM_TTL_MS
      : Math.min(CLAIM_TTL_MS, Math.max(0, expires - serverNow));
  return receivedAt + remaining;
}

/** Whole seconds until `deadline` (never negative). */
export function secondsLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** `m:ss`, e.g. 900 → "15:00", 65 → "1:05". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
