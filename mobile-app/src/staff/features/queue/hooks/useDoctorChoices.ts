import { useQuery } from '@tanstack/react-query';

import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { fetchDoctorChoices } from '../api/queue.api';
import { queueKeys } from '../api/queue.keys';

/** Doctors at the active location (transfer targets of the close-session sheet). Fetched only when `enabled`. */
export function useDoctorChoices(enabled: boolean) {
  const orgId = useStaffAuthStore((s) => s.activeOrganizationId);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  return useQuery({
    queryKey: queueKeys.doctors(orgId, locationId),
    queryFn: fetchDoctorChoices,
    enabled: enabled && !!orgId && !!locationId,
    staleTime: 10 * 60_000,
  });
}
