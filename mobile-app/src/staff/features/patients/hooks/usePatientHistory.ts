import { useQuery } from '@tanstack/react-query';

import { useAccess } from '@/staff/features/access';

import { fetchPatientHistory } from '../api/patients.api';
import { patientKeys } from '../api/patients.keys';
import { isGateOpen, toGated } from './gated-query';
import { usePatientTenant } from './usePatientTenant';

/**
 * Visits and encounters — needs `patients.clinical.view`. Returns a `GatedQuery`:
 * loading / denied (never ran, no error) / allowed.
 */
export function usePatientHistory(patientId: string | undefined) {
  const { status, can } = useAccess();
  const { orgId, locationId, ready } = usePatientTenant();
  const id = patientId ?? '';
  const allowed = isGateOpen(status, can('patients.clinical.view'));
  const query = useQuery({
    queryKey: patientKeys.history(orgId, locationId, id),
    queryFn: () => fetchPatientHistory(id),
    enabled: allowed && ready && !!patientId,
  });
  return toGated(status, allowed, query);
}
