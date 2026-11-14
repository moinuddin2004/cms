import { useQuery } from '@tanstack/react-query';

import { useAccess } from '@/staff/features/access';

import { fetchPatientPrescriptions } from '../api/patients.api';
import { patientKeys } from '../api/patients.keys';
import { sortPrescriptions } from '../lib/sort-prescriptions';
import { isGateOpen, toGated } from './gated-query';
import { usePatientTenant } from './usePatientTenant';

/**
 * First page (20) of prescriptions, finalized/amended first and drafts last.
 * Needs `patients.clinical.view` + feature `patients.prescriptions`; returns a `GatedQuery` (loading / denied / allowed).
 */
export function usePatientPrescriptions(patientId: string | undefined) {
  const { status, can, hasFeature } = useAccess();
  const { orgId, locationId, ready } = usePatientTenant();
  const id = patientId ?? '';
  const allowed = isGateOpen(status, can('patients.clinical.view') && hasFeature('patients.prescriptions'));
  const query = useQuery({
    queryKey: patientKeys.prescriptions(orgId, locationId, id, 1),
    queryFn: () => fetchPatientPrescriptions(id, 1),
    select: (page) => ({ ...page, data: sortPrescriptions(page.data) }),
    enabled: allowed && ready && !!patientId,
  });
  return toGated(status, allowed, query);
}
