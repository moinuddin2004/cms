import { useQuery } from '@tanstack/react-query';

import { useAccess } from '@/staff/features/access';

import { fetchPatientPrescriptions } from '../api/patients.api';
import { patientKeys } from '../api/patients.keys';
import { sortPrescriptions } from '../lib/sort-prescriptions';
import { usePatientTenant } from './usePatientTenant';

/**
 * First page (20) of prescriptions, finalized/amended first and drafts last.
 * Needs `patients.clinical.view` + feature `patients.prescriptions`; `allowed: false` = never ran.
 */
export function usePatientPrescriptions(patientId: string | undefined) {
  const { can, hasFeature } = useAccess();
  const { orgId, locationId, ready } = usePatientTenant();
  const id = patientId ?? '';
  const allowed = can('patients.clinical.view') && hasFeature('patients.prescriptions');
  const query = useQuery({
    queryKey: patientKeys.prescriptions(orgId, locationId, id, 1),
    queryFn: () => fetchPatientPrescriptions(id, 1),
    select: (page) => ({ ...page, data: sortPrescriptions(page.data) }),
    enabled: allowed && ready && !!patientId,
  });
  return { allowed, query };
}
