/**
 * Time travel for the seed run.
 *
 * The seed builds ~3 months of clinic history (appointments, visits,
 * invoices, payments, lab orders) by calling the app's own services. Those
 * services take "now" from `new Date()` / `Date.now()` (ClockService too)
 * and, in SQL, from Postgres `now()` (the queue, lab workflows, …). The seed
 * moves BOTH clocks to the day it is simulating, so the services stamp
 * everything with that day exactly as they would have:
 *
 * - JS: `Date` is replaced by a subclass with an offset (below).
 * - SQL: `lib/db-clock.ts` puts a `now()` that adds the same offset first on
 *   the seed connections' search_path; it is synced before each query.
 *
 * Column defaults (`created_at DEFAULT now()`) are bound to the real
 * `pg_catalog.now()` at CREATE TABLE time, so they still get the real time —
 * `steps/98-backdate.ts` fixes those afterwards.
 *
 * MUST be imported before anything else (see `run.ts`), so every module
 * captures the patched `Date`.
 */
const RealDate = Date;
let offsetMs = 0;

class SeedDate extends RealDate {
  constructor(...args: any[]) {
    if (args.length === 0) super(RealDate.now() + offsetMs);
    else super(...(args as [any]));
  }

  static now(): number {
    return RealDate.now() + offsetMs;
  }
}

(globalThis as any).Date = SeedDate;

/** Current clock offset (ms) — read by the DB clock sync. */
export function clockOffsetMs(): number {
  return offsetMs;
}

/** Real wall-clock time, ignoring time travel. */
export function realNow(): Date {
  return new RealDate(RealDate.now());
}

/** Move the process clock so that "now" is `at` (time keeps flowing from there). */
export function travelTo(at: Date): void {
  offsetMs = at.getTime() - RealDate.now();
}

/** Back to the real time. */
export function travelHome(): void {
  offsetMs = 0;
}
