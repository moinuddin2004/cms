/**
 * Pure timezone helpers built on Intl — no external tz library.
 *
 * Every clinic-facing "day" and "time of day" must be computed in the
 * LOCATION's timezone, never the server's. These helpers turn an instant into
 * location-local parts and back.
 */

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let fmt = partsFormatterCache.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    });
    partsFormatterCache.set(tz, fmt);
  }
  return fmt;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday, in the given timezone. */
  dayOfWeek: number;
}

/** True when `tz` is an IANA zone this runtime understands. */
export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function safeTimezone(tz: string | null | undefined): string {
  return isValidTimezone(tz) ? tz : 'UTC';
}

/** Wall-clock parts of `instant` as seen in `tz`. */
export function localParts(tz: string, instant: Date): LocalParts {
  const parts = partsFormatter(tz).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '0';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    dayOfWeek: WEEKDAYS.indexOf(get('weekday')),
  };
}

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

/** Location-local calendar date, "YYYY-MM-DD". */
export function localDate(tz: string, instant: Date): string {
  const p = localParts(tz, instant);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** Location-local time of day, "HH:MM". */
export function localHHMM(tz: string, instant: Date): string {
  const p = localParts(tz, instant);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Offset of `tz` from UTC at `instant`, in milliseconds (east = positive). */
function offsetMs(tz: string, instant: Date): number {
  const p = localParts(tz, instant);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  const whole = instant.getTime() - instant.getUTCMilliseconds();
  return asUtc - whole;
}

/**
 * The instant at which the wall clock in `tz` reads `ymd` + `hhmm`.
 * Two-pass offset correction handles DST transitions.
 */
export function zonedTimeToUtc(tz: string, ymd: string, hhmm = '00:00'): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h || 0, mi || 0, 0, 0);
  const first = offsetMs(tz, new Date(guess));
  let result = guess - first;
  const second = offsetMs(tz, new Date(result));
  if (second !== first) result = guess - second;
  return new Date(result);
}

/** "YYYY-MM-DD" plus `days`, as a plain calendar date (no timezone). */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Day of week (0 = Sunday) of a plain calendar date. */
export function dayOfWeekOf(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Half-open UTC range [start, end) covering the local day `ymd` in `tz`. */
export function localDayRange(
  tz: string,
  ymd: string,
): { start: Date; end: Date } {
  return {
    start: zonedTimeToUtc(tz, ymd, '00:00'),
    end: zonedTimeToUtc(tz, addDays(ymd, 1), '00:00'),
  };
}

export function isYmd(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
