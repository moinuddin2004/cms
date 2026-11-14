import { useQuery } from '@tanstack/react-query';

import { useAccess } from '@/staff/features/access';

import { fetchPatientVitals } from '../api/patients.api';
import { patientKeys } from '../api/patients.keys';
import { isGateOpen, toGated } from './gated-query';
import { usePatientTenant } from './usePatientTenant';

/** Newest first — `data[0]` is the latest. Needs `patients.clinical.view`; returns a `GatedQuery` (loading / denied / allowed). */
export function usePatientVitals(patientId: string | undefined) {
  const { status, can } = useAccess();
  const { orgId, locationId, ready } = usePatientTenant();
  const id = patientId ?? '';
  const allowed = isGateOpen(status, can('patients.clinical.view'));
  const query = useQuery({
    queryKey: patientKeys.vitals(orgId, locationId, id),
    queryFn: () => fetchPatientVitals(id),
    enabled: allowed && ready && !!patientId,
  });
  return toGated(status, allowed, query);
}
