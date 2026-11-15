import type { AppointmentFilters } from '../types/appointments.types';

type Id = string | null;

/** True when `filters` narrow the day list beyond "everything incl. walk-ins". */
export function hasActiveFilters(filters: AppointmentFilters): boolean {
  return (
    !!filters.doctorId ||
    !!filters.status ||
    !!filters.search?.trim() ||
    filters.includeWalkIns === false
  );
}

/** Canonical filter object for a key (no undefined / default fields). */
export function normalizeFilters(filters: AppointmentFilters): AppointmentFilters {
  const out: AppointmentFilters = {};
  if (filters.doctorId) out.doctorId = filters.doctorId;
  if (filters.status) out.status = filters.status;
  const search = filters.search?.trim();
  if (search) out.search = search;
  if (filters.includeWalkIns === false) out.includeWalkIns = false;
  return out;
}

/**
 * Staff query keys: org AND location AND clinic day are in every list/stats
 * key (docs/04 §7). The UNFILTERED day list is exactly
 * `['appointments','list',orgId,locationId,ymd]` — the one shape `persist.ts`
 * writes to disk, for today only. A filtered list appends the filter object,
 * which makes it non-persistable (search text must never reach disk).
 */
export const appointmentKeys = {
  all: ['appointments'] as const,
  list: (orgId: Id, locationId: Id, ymd: string, filters: AppointmentFilters = {}) =>
    hasActiveFilters(filters)
      ? (['appointments', 'list', orgId, locationId, ymd, normalizeFilters(filters)] as const)
      : (['appointments', 'list', orgId, locationId, ymd] as const),
  stats: (orgId: Id, locationId: Id, ymd: string) =>
    ['appointments', 'stats', orgId, locationId, ymd] as const,
  /** Prefix of every arrivals list: queue realtime invalidates it (a check-in elsewhere changes it). */
  arrivalsAll: () => ['appointments', 'arrivals'] as const,
  arrivals: (orgId: Id, locationId: Id, ymd: string) =>
    ['appointments', 'arrivals', orgId, locationId, ymd] as const,
  /** Next-N from now: moves with the clock, never persisted. */
  upcoming: (orgId: Id, locationId: Id, ymd: string, limit: number) =>
    ['appointments', 'upcoming', orgId, locationId, ymd, limit] as const,
  detail: (orgId: Id, locationId: Id, id: string) =>
    ['appointments', 'detail', orgId, locationId, id] as const,
  doctors: (orgId: Id, locationId: Id) => ['appointments', 'doctors', orgId, locationId] as const,
};
