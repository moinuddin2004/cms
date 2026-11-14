import { useQuery } from '@tanstack/react-query';

import { useAccess } from '@/staff/features/access';

import { fetchPatientHistory } from '../api/patients.api';
import { patientKeys } from '../api/patients.keys';
import { usePatientTenant } from './usePatientTenant';

/**
 * Visits and encounters — needs `patients.clinical.view`. `allowed: false` means
 * the query never ran (no error to show); the screen hides the segment.
 */
export function usePatientHistory(patientId: string | undefined) {
  const { can } = useAccess();
  const { orgId, locationId, ready } = usePatientTenant();
  const id = patientId ?? '';
  const allowed = can('patients.clinical.view');
  const query = useQuery({
    queryKey: patientKeys.history(orgId, locationId, id),
    queryFn: () => fetchPatientHistory(id),
    enabled: allowed && ready && !!patientId,
  });
  return { allowed, query };
}
