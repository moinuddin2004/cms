import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { fetchPatients } from '../api/patients.api';
import { patientKeys } from '../api/patients.keys';
import type { PatientQuery } from '../types/patients.types';

export const PATIENTS_PAGE_SIZE = 20;
export const MIN_SEARCH_LENGTH = 2;

/** What a screen controls; paging belongs to this hook. */
export type PatientListFilters = Omit<PatientQuery, 'page' | 'limit'>;

/**
 * Canonical list query: search is trimmed and dropped under 2 characters,
 * boolean filters exist only as `true` (the backend reads `"false"` as true — R-02),
 * undefined keys are removed so equal filters share one cache key.
 */
export function normalizePatientFilters(filters: PatientListFilters): PatientListFilters {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) out[key] = value;
  }
  const search = typeof out.search === 'string' ? out.search.trim() : '';
  if (search.length >= MIN_SEARCH_LENGTH) out.search = search;
  else delete out.search;
  for (const key of ['isBlacklisted', 'isMinor']) {
    if (out[key] !== true) delete out[key];
  }
  return out as PatientListFilters;
}

/**
 * Patients list, 20 per page, next page while `page < totalPages`. The key holds
 * the search text, so this query is never allow-listed for persistence.
 */
export function usePatientsInfinite(filters: PatientListFilters = {}) {
  const orgId = useStaffAuthStore((s) => s.activeOrganizationId);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  const query = { ...normalizePatientFilters(filters), limit: PATIENTS_PAGE_SIZE };

  return useInfiniteQuery({
    queryKey: patientKeys.list(orgId, locationId, query),
    queryFn: ({ pageParam }) => fetchPatients({ ...query, page: pageParam }),
    initialPageParam: 1,
    // a new search keeps the previous rows on screen instead of blanking to the skeleton
    placeholderData: keepPreviousData,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: !!orgId && !!locationId,
  });
}
