import type { PatientQuery } from '../types/patients.types';

/**
 * Query params for `GET /patients`. The backend parses `isBlacklisted` /
 * `isMinor` with `@Type(() => Boolean)`, so `"false"` would filter as `true`:
 * anything other than `true` is dropped here, even if a caller bypasses the type.
 */
export function patientQueryParams(query: PatientQuery): Record<string, unknown> {
  const params: Record<string, unknown> = { ...query };
  for (const key of ['isBlacklisted', 'isMinor'] as const) {
    if (params[key] !== true) delete params[key];
  }
  return params;
}
