import { useQuery } from '@tanstack/react-query';

import { fetchPatient } from '../api/patients.api';
import { patientKeys } from '../api/patients.keys';
import { usePatientTenant } from './usePatientTenant';

/** One patient. Detail queries are in the offline allow-list (`staff/lib/persist.ts`). */
export function usePatient(patientId: string | undefined) {
  const { orgId, locationId, ready } = usePatientTenant();
  const id = patientId ?? '';
  return useQuery({
    queryKey: patientKeys.detail(orgId, locationId, id),
    queryFn: () => fetchPatient(id),
    enabled: ready && !!patientId,
  });
}
