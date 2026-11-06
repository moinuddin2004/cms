/**
 * SQL fragments shared by the clinical / operational reports.
 *
 * Patients belong to the organization; a patient counts for a location by
 * `primary_location_id` (patients without one only show in the
 * all-locations view). Every instant column is `timestamptz`.
 */

/**
 * Formerly turned a naive UTC `timestamp` column into `timestamptz`. All such
 * columns are `timestamptz` now, so this is the column itself — applying
 * `AT TIME ZONE 'UTC'` to a `timestamptz` would yield a naive timestamp and
 * shift every later `AT TIME ZONE <clinic tz>` the wrong way.
 */
export const utc = (col: string) => col;

/** Clinic-local date of a `timestamptz` expression (`tz` = a `$n` param). */
export const localDay = (expr: string, tz: string) =>
  `(${expr} AT TIME ZONE ${tz})::date`;

/** Patient `p` belongs to the report's locations (`locs`, `wholeOrg` = `$n` params). */
export const patientAtLocations = (p: string, locs: string, wholeOrg: string) =>
  `(${p}.primary_location_id = ANY(${locs}) OR (${wholeOrg}::boolean AND ${p}.primary_location_id IS NULL))`;

/** Whole minutes between two `timestamptz` expressions. */
export const minutesBetween = (from: string, to: string) =>
  `EXTRACT(EPOCH FROM (${to} - ${from})) / 60.0`;

/** People-facing enum text: `walk_in` → `Walk In`. */
export const label = (expr: string) =>
  `initcap(replace(${expr}::text, '_', ' '))`;

/** One decimal (minutes, days); null stays null. */
export const round1 = (v: unknown): number | null =>
  v == null ? null : Math.round(Number(v) * 10) / 10;

/** Doctor of an encounter: its queue session's doctor, else its appointment's. */
export const ENCOUNTER_DOCTOR = `COALESCE(qs.doctor_id, ap.doctor_id)`;
export const ENCOUNTER_DOCTOR_JOINS = `
  LEFT JOIN queue_entries qe ON qe.id = e.queue_entry_id
  LEFT JOIN queue_sessions qs ON qs.id = qe.queue_session_id
  LEFT JOIN appointments ap ON ap.id = e.appointment_id`;
