import { useQuery } from '@tanstack/react-query';

import { fetchPatientVisits } from '../api/queue.api';
import { queueKeys } from '../api/queue.keys';

/** A patient's queue visits (history on the patient file). */
export function usePatientQueueVisits(patientId: string | undefined) {
  return useQuery({
    queryKey: queueKeys.patientVisits(patientId ?? ''),
    queryFn: () => fetchPatientVisits(patientId ?? ''),
    enabled: !!patientId,
    staleTime: 0,
  });
}
