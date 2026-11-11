import { TZDate, tz } from '@date-fns/tz';
import { format, isValid } from 'date-fns';

/**
 * Zone-aware date/time helpers — PURE: the IANA zone is always a parameter, so
 * this module imports neither space. A space binds its zones in its own
 * `lib/datetime.ts` (staff: the active location's `locations.timezone`).
 *
 * Rules (same as the web app):
 * - The API speaks UTC instants (`2026-11-02T10:00:00.000Z`) and plain calendar
 *   dates (`2026-11-02`).
 * - An instant is SHOWN and ENTERED on the clock of the zone passed in.
 * - Calendar dates (DOB, …) have no timezone: use `formatYmd`.
 *
 * Never: `new Date(x).toLocale*String()`, `format(new Date(x), …)` without a
 * zone, `toISOString().slice(0, 10)` as "today".
 */
export type DateInput = Date | string | number;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** The phone's IANA timezone, e.g. "Asia/Karachi". */
export const deviceTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** True when the string is an IANA zone this runtime knows. */
export function isValidTimezone(zone: string | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export const isYmd = (value: unknown): value is string =>
  typeof value === 'string' && YMD.test(value);

/** A calendar date as a local Date at noon, so it never rolls over. */
export const ymdToDate = (ymd: string) => new Date(`${ymd}T12:00:00`);

/** Any Date as a UTC ISO string for the API. */
export const toUtcIso = (value: DateInput) => new Date(new Date(value).getTime()).toISOString();

/** An instant as a date in `zone`: `getHours()` etc. read that zone's wall time. */
export const zonedDate = (value: DateInput, zone: string) =>
  new TZDate(new Date(value).getTime(), zone);

/** date-fns v4 options that run a function in `zone`. */
export const inZone = (zone: string) => ({ in: tz(zone) });

/** Today's calendar date in `zone`, "YYYY-MM-DD". */
export const todayYmdInZone = (zone: string) => format(zonedDate(Date.now(), zone), 'yyyy-MM-dd');

/** Wall time `ymd` + `hhmm` in `zone` → UTC ISO string for the API. */
export function zonedDateTimeToUtc(ymd: string, hhmm: string, zone: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return toUtcIso(new TZDate(y, m - 1, d, h || 0, mi || 0, zone));
}

/** UTC bounds of a calendar day in `zone`, for API range filters. */
export function dayBoundsInZone(ymd: string, zone: string): { start: string; end: string } {
  const next = ymdToDate(ymd);
  next.setDate(next.getDate() + 1);
  const nextMidnight = Date.parse(zonedDateTimeToUtc(format(next, 'yyyy-MM-dd'), '00:00', zone));
  return {
    start: zonedDateTimeToUtc(ymd, '00:00', zone),
    end: new Date(nextMidnight - 1).toISOString(),
  };
}

/**
 * Format an instant on `zone`'s clock. A "YYYY-MM-DD" string is formatted as a
 * calendar date (no tz shift). Empty / invalid → "—".
 */
export function formatInZone(
  value: DateInput | null | undefined,
  zone: string,
  pattern: string,
): string {
  if (value === null || value === undefined || value === '') return '—';
  if (isYmd(value)) return format(ymdToDate(value), pattern);
  const d = new Date(value);
  return isValid(d) ? format(d, pattern, inZone(zone)) : '—';
}

/** A calendar date "YYYY-MM-DD" with a pattern (no tz shift). */
export function formatYmd(ymd: string | null | undefined, pattern = 'MMM d, yyyy') {
  if (!ymd) return '—';
  const d = ymdToDate(ymd.slice(0, 10));
  return isValid(d) ? format(d, pattern) : '—';
}
