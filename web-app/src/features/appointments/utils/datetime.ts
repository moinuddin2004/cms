import { format } from 'date-fns'
import { formatInClinic, utcToClinicInput } from '@/lib/datetime'
import type { DateInput } from '@/lib/datetime'

/**
 * Picker value "YYYY-MM-DDTHH:mm" — always the CLINIC's wall time.
 * - string → a UTC instant from the API, shown on the clinic's clock.
 * - Date   → a grid cell the UI built from local fields (day + slot); its
 *   fields already ARE the clinic wall time, so they are copied as-is.
 * Send it back with `clinicInputToUtc` from `@/lib/datetime`.
 */
export function toDateTimeLocalValue(date: Date | string): string {
  if (typeof date === 'string') return utcToClinicInput(date)
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

/*
 * FullCalendar runs with timeZone="UTC" and is fed clinic wall times
 * ("UTC-coercion"): no named-timezone plugin needed, and the grid shows the
 * clinic's clock whatever the browser's timezone is.
 */

/** API instant → offset-less clinic wall time for a FullCalendar event. */
export function toCalendarTime(value: DateInput): string {
  return formatInClinic(value, "yyyy-MM-dd'T'HH:mm:ss")
}

/** A FullCalendar Date (UTC-coerced) → picker value "YYYY-MM-DDTHH:mm". */
export function fromCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 16)
}

/** A FullCalendar Date (UTC-coerced) → its calendar day "YYYY-MM-DD". */
export function calendarDateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10)
}
