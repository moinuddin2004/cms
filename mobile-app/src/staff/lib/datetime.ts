import { tz } from '@date-fns/tz';

import {
  dayBoundsInZone,
  deviceTimezone,
  formatInZone,
  formatYmd,
  isYmd,
  isValidTimezone,
  toUtcIso,
  todayYmdInZone,
  ymdToDate,
  zonedDate,
  zonedDateTimeToUtc,
  type DateInput,
} from '@/core/datetime';
import { activeOrganization, useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

/**
 * The ONE place staff clinic dates and times are converted: every helper binds
 * the active location's timezone (`locations.timezone`) — never the phone's.
 * The pure maths lives in `@/core/datetime` (zone as a parameter).
 *
 * Never: `new Date(x).toLocale*String()`, `format(new Date(x), …)` without
 * `inClinic()`, `toISOString().slice(0, 10)` as "today".
 */
export type { DateInput };
export {
  deviceTimezone,
  formatYmd,
  isYmd,
  isValidTimezone,
  toUtcIso,
  ymdToDate,
  zonedDate,
  zonedDateTimeToUtc,
};

type TzState = Parameters<typeof activeOrganization>[0] & { activeLocationId: string | null };

function pickTimezone(s: TzState): string {
  const zone = activeOrganization(s)?.locations.find((l) => l.id === s.activeLocationId)?.timezone;
  return isValidTimezone(zone) ? zone : deviceTimezone();
}

/** The active location's IANA timezone, e.g. "Asia/Karachi". */
export const clinicTimezone = () => pickTimezone(useStaffAuthStore.getState());

/** Hook form — re-renders when the location changes. */
export const useClinicTimezone = () => useStaffAuthStore(pickTimezone);

/** date-fns v4 options that run a function in the clinic's timezone. */
export const inClinic = (zone: string = clinicTimezone()) => ({ in: tz(zone) });

/** An instant as a clinic-zoned date: `getHours()` etc. read clinic wall time. */
export const clinicDate = (value: DateInput = Date.now()) => zonedDate(value, clinicTimezone());

/** Today's calendar date at the clinic, "YYYY-MM-DD". */
export const todayYmd = () => todayYmdInZone(clinicTimezone());

/** Clinic wall time `ymd` + `hhmm` → UTC ISO string for the API. */
export const clinicDateTimeToUtc = (ymd: string, hhmm: string) =>
  zonedDateTimeToUtc(ymd, hhmm, clinicTimezone());

/** UTC bounds of a clinic calendar day, for API range filters. */
export const clinicDayBounds = (ymd: string) => dayBoundsInZone(ymd, clinicTimezone());

/**
 * Format an instant on the clinic's clock. A "YYYY-MM-DD" string is formatted
 * as a calendar date (no tz shift). Empty / invalid → "—".
 */
export const formatInClinic = (value: DateInput | null | undefined, pattern: string) =>
  formatInZone(value, clinicTimezone(), pattern);

export const formatDate = (v: DateInput | null | undefined) => formatInClinic(v, 'MMM d, yyyy');
export const formatDateTime = (v: DateInput | null | undefined) =>
  formatInClinic(v, 'MMM d, yyyy, h:mm a');
export const formatTime = (v: DateInput | null | undefined) => formatInClinic(v, 'h:mm a');
