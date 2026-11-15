/** Whole seconds until `expiresAt` (never negative). */
export function secondsLeft(expiresAt: string, now: number): number {
  const ms = Date.parse(expiresAt) - now;
  return Number.isNaN(ms) ? 0 : Math.max(0, Math.ceil(ms / 1000));
}

/** `m:ss`, e.g. 15:00 → "15:00", 65 → "1:05". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
