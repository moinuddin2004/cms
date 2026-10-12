/**
 * Pure arrival rules for booked appointments (no I/O; the orchestrator passes
 * the transaction's `now` and the effective policy).
 */

/** True when the patient is later than `max_late_min` and may not get a token. */
export function isBeyondMaxLate(
  scheduledStart: Date,
  now: Date,
  maxLateMin: number,
): boolean {
  return now.getTime() > scheduledStart.getTime() + maxLateMin * 60_000;
}
