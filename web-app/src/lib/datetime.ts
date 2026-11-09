import { TZDate, tz } from '@date-fns/tz'
import { format, isValid } from 'date-fns'
import { useAuthStore } from '@/store/useAuthStore'

/**
 * The ONE place clinic dates and times are converted.
 *
 * - The API always speaks UTC instants (`2026-11-02T10:00:00.000Z`) and plain
 *   calendar dates (`2026-11-02`).
 * - Every instant is SHOWN and ENTERED in the active location's timezone
 *   (`locations.timezone`, picked in location settings) — never the browser's.
 * - Calendar dates (DOB, expense date, …) have no timezone: never pass them
 *   through the clinic-tz helpers, use `formatYmd`.
 *
 * date-fns functions take the clinic zone via `inClinic()`:
 *   `startOfDay(x, inClinic())`, `isToday(x, inClinic())`.
 */

export type DateInput = Date | string | number

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Used when no location is active (lab portal, before login). */
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

function isValidTimezone(zone: string | undefined): zone is string {
  if (!zone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

function pickTimezone(
  s: Pick<
    ReturnType<typeof useAuthStore.getState>,
    'accessibleOrganizations' | 'activeOrganizationId' | 'activeLocationId'
  >,
): string {
  const org = s.accessibleOrganizations.find(
    (o) => o.id === s.activeOrganizationId,
  )
  const zone = org?.locations.find((l) => l.id === s.activeLocationId)?.timezone
  return isValidTimezone(zone) ? zone : browserTimezone()
}

/** The active location's IANA timezone, e.g. "Asia/Karachi". */
export function clinicTimezone(): string {
  return pickTimezone(useAuthStore.getState())
}

/** Hook form of `clinicTimezone()` — re-renders when the location changes. */
export function useClinicTimezone(): string {
  return useAuthStore(pickTimezone)
}

/** date-fns v4 options that run a function in the clinic's timezone. */
export function inClinic(zone: string = clinicTimezone()) {
  return { in: tz(zone) }
}

/** True for a plain calendar date "YYYY-MM-DD". */
export function isYmd(value: unknown): value is string {
  return typeof value === 'string' && YMD.test(value)
}

/** An instant as a clinic-zoned date: `getHours()` etc. read clinic wall time. */
export function clinicDate(value: DateInput = Date.now()): TZDate {
  return new TZDate(new Date(value).getTime(), clinicTimezone())
}

/** "Now" on the clinic's wall clock. */
export const nowInClinic = () => clinicDate()

/** Any Date (including a TZDate) as a UTC ISO string for the API. */
export function toUtcIso(value: DateInput): string {
  return new Date(new Date(value).getTime()).toISOString()
}

/** Today's calendar date at the clinic, "YYYY-MM-DD". */
export function todayYmd(): string {
  return format(nowInClinic(), 'yyyy-MM-dd')
}

/** The clinic calendar date an instant falls on, "YYYY-MM-DD". */
export function toClinicYmd(value: DateInput): string {
  return format(clinicDate(value), 'yyyy-MM-dd')
}

/** A plain calendar date as a local Date (noon, so it never rolls over). */
export function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`)
}

/** A Date used only as a calendar-day carrier (e.g. a picker's selected day) → "YYYY-MM-DD". */
export function dateToYmd(day: Date): string {
  return format(day, 'yyyy-MM-dd')
}

/**
 * UTC bounds of a clinic calendar day, for API range filters:
 * `start` = clinic midnight, `end` = the last millisecond of that day.
 */
export function clinicDayBounds(day: string | Date): {
  start: string
  end: string
} {
  const ymd = typeof day === 'string' ? day : dateToYmd(day)
  const next = ymdToDate(ymd)
  next.setDate(next.getDate() + 1)
  const nextMidnight = Date.parse(clinicDateTimeToUtc(dateToYmd(next), '00:00'))
  return {
    start: clinicDateTimeToUtc(ymd, '00:00'),
    end: new Date(nextMidnight - 1).toISOString(),
  }
}

/** Clinic wall time `ymd` + `hhmm` → UTC ISO string for the API. */
export function clinicDateTimeToUtc(ymd: string, hhmm: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  return toUtcIso(new TZDate(y, m - 1, d, h || 0, mi || 0, clinicTimezone()))
}

/** Picker value "yyyy-MM-ddTHH:mm" (clinic wall time) → UTC ISO string. */
export function clinicInputToUtc(local: string): string {
  const [ymd, hhmm = '00:00'] = local.split('T')
  return clinicDateTimeToUtc(ymd, hhmm.slice(0, 5))
}

/** UTC instant → picker value "yyyy-MM-ddTHH:mm" on the clinic's wall clock. */
export function utcToClinicInput(value: DateInput): string {
  return format(clinicDate(value), "yyyy-MM-dd'T'HH:mm")
}

/** UTC instant → clinic "HH:mm". */
export function toClinicHHMM(value: DateInput): string {
  return format(clinicDate(value), 'HH:mm')
}

/**
 * Format an instant in the clinic's timezone with a date-fns pattern.
 * A "YYYY-MM-DD" string is formatted as a calendar date (no tz shift).
 * Empty / invalid input → "—".
 */
export function formatInClinic(
  value: DateInput | null | undefined,
  pattern: string,
): string {
  if (value === null || value === undefined || value === '') return '—'
  if (isYmd(value)) return format(ymdToDate(value), pattern)
  const d = new Date(value)
  if (!isValid(d)) return '—'
  return format(d, pattern, inClinic())
}

/** A calendar date "YYYY-MM-DD" with a date-fns pattern (no tz shift). */
export function formatYmd(
  ymd: string | null | undefined,
  pattern = 'MMM d, yyyy',
) {
  if (!ymd) return '—'
  const d = ymdToDate(ymd.slice(0, 10))
  return isValid(d) ? format(d, pattern) : '—'
}

/** "Nov 2, 2026" */
export const formatDate = (value: DateInput | null | undefined) =>
  formatInClinic(value, 'MMM d, yyyy')

/** "Nov 2, 2026, 3:00 PM" */
export const formatDateTime = (value: DateInput | null | undefined) =>
  formatInClinic(value, 'MMM d, yyyy, h:mm a')

/** "3:00 PM" */
export const formatTime = (value: DateInput | null | undefined) =>
  formatInClinic(value, 'h:mm a')

/** Timezones offered in clinic / location settings. */
export const TIMEZONE_OPTIONS = [
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Qatar',
  'Asia/Kuwait',
  'Asia/Bahrain',
  'Asia/Muscat',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Kathmandu',
  'Asia/Kabul',
  'Asia/Tehran',
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Toronto',
  'Australia/Sydney',
  'UTC',
]

/** "Asia/Karachi (UTC+05:00)" for a timezone picker. */
export function timezoneLabel(zone: string): string {
  try {
    const offset = format(new TZDate(Date.now(), zone), 'xxx')
    return `${zone.replace(/_/g, ' ')} (UTC${offset === 'Z' ? '+00:00' : offset})`
  } catch {
    return zone
  }
}
