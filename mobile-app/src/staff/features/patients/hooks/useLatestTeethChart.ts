import { useQuery } from '@tanstack/react-query';

import { useAccess } from '@/staff/features/access';

import { fetchPatientTeethCharts } from '../api/patients.api';
import { patientKeys } from '../api/patients.keys';
import { latestTeethChart } from '../lib/latest-teeth-chart';
import { usePatientTenant } from './usePatientTenant';

/**
 * The latest teeth chart, or `null` when the patient has none.
 * Needs `patients.clinical.view` + feature `patients.teeth_chart`; `allowed: false` = never ran.
 */
export function useLatestTeethChart(patientId: string | undefined) {
  const { can, hasFeature } = useAccess();
  const { orgId, locationId, ready } = usePatientTenant();
  const id = patientId ?? '';
  const allowed = can('patients.clinical.view') && hasFeature('patients.teeth_chart');
  const query = useQuery({
    queryKey: patientKeys.teethCharts(orgId, locationId, id),
    queryFn: () => fetchPatientTeethCharts(id),
    select: latestTeethChart,
    enabled: allowed && ready && !!patientId,
  });
  return { allowed, query };
}
