/**
 * SQL fragments shared by the clinical / operational reports.
 *
 * Patients belong to the organization; a patient counts for a location by
 * `primary_location_id` (patients without one only show in the
 * all-locations view). `patients.created_at` and other `CreateDateColumn`s
 * without `type: 'timestamptz'` are `timestamp` holding UTC wall time.
 */

/** A UTC `timestamp` column as `timestamptz`. */
export const utc = (col: string) => `(${col} AT TIME ZONE 'UTC')`;

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
