import { TZDate, tz } from '@date-fns/tz';
import { format, isValid } from 'date-fns';

import { activeOrganization, useAuthStore } from '@/store/useAuthStore';

/**
 * The ONE place clinic dates and times are converted (same rules as the web app).
 *
 * - The API speaks UTC instants (`2026-11-02T10:00:00.000Z`) and plain calendar
 *   dates (`2026-11-02`).
 * - Every instant is SHOWN and ENTERED on the active location's clock
 *   (`locations.timezone`) — never the phone's.
 * - Calendar dates (DOB, …) have no timezone: use `formatYmd`.
 *
 * Never: `new Date(x).toLocale*String()`, `format(new Date(x), …)` without
 * `inClinic()`, `toISOString().slice(0, 10)` as "today".
 */
export type DateInput = Date | string | number;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

const deviceTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function isValidTimezone(zone: string | undefined): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

type TzState = Parameters<typeof activeOrganization>[0] & { activeLocationId: string | null };

function pickTimezone(s: TzState): string {
  const zone = activeOrganization(s)?.locations.find((l) => l.id === s.activeLocationId)?.timezone;
  return isValidTimezone(zone) ? zone : deviceTimezone();
}

/** The active location's IANA timezone, e.g. "Asia/Karachi". */
export const clinicTimezone = () => pickTimezone(useAuthStore.getState());

/** Hook form — re-renders when the location changes. */
export const useClinicTimezone = () => useAuthStore(pickTimezone);

/** date-fns v4 options that run a function in the clinic's timezone. */
export const inClinic = (zone: string = clinicTimezone()) => ({ in: tz(zone) });

export const isYmd = (value: unknown): value is string =>
  typeof value === 'string' && YMD.test(value);

/** An instant as a clinic-zoned date: `getHours()` etc. read clinic wall time. */
export const clinicDate = (value: DateInput = Date.now()) =>
  new TZDate(new Date(value).getTime(), clinicTimezone());

/** A calendar date as a local Date at noon, so it never rolls over. */
export const ymdToDate = (ymd: string) => new Date(`${ymd}T12:00:00`);

/** Today's calendar date at the clinic, "YYYY-MM-DD". */
export const todayYmd = () => format(clinicDate(), 'yyyy-MM-dd');

/** Any Date as a UTC ISO string for the API. */
export const toUtcIso = (value: DateInput) => new Date(new Date(value).getTime()).toISOString();

/** Clinic wall time `ymd` + `hhmm` → UTC ISO string for the API. */
export function clinicDateTimeToUtc(ymd: string, hhmm: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return toUtcIso(new TZDate(y, m - 1, d, h || 0, mi || 0, clinicTimezone()));
}

/** UTC bounds of a clinic calendar day, for API range filters. */
export function clinicDayBounds(ymd: string): { start: string; end: string } {
  const next = ymdToDate(ymd);
  next.setDate(next.getDate() + 1);
  const nextMidnight = Date.parse(clinicDateTimeToUtc(format(next, 'yyyy-MM-dd'), '00:00'));
  return {
    start: clinicDateTimeToUtc(ymd, '00:00'),
    end: new Date(nextMidnight - 1).toISOString(),
  };
}

/**
 * Format an instant on the clinic's clock. A "YYYY-MM-DD" string is formatted
 * as a calendar date (no tz shift). Empty / invalid → "—".
 */
export function formatInClinic(value: DateInput | null | undefined, pattern: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (isYmd(value)) return format(ymdToDate(value), pattern);
  const d = new Date(value);
  return isValid(d) ? format(d, pattern, inClinic()) : '—';
}

/** A calendar date "YYYY-MM-DD" with a pattern (no tz shift). */
export function formatYmd(ymd: string | null | undefined, pattern = 'MMM d, yyyy') {
  if (!ymd) return '—';
  const d = ymdToDate(ymd.slice(0, 10));
  return isValid(d) ? format(d, pattern) : '—';
}

export const formatDate = (v: DateInput | null | undefined) => formatInClinic(v, 'MMM d, yyyy');
export const formatDateTime = (v: DateInput | null | undefined) =>
  formatInClinic(v, 'MMM d, yyyy, h:mm a');
export const formatTime = (v: DateInput | null | undefined) => formatInClinic(v, 'h:mm a');
