import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

/** Org + location every patient key carries; `ready` once both are active. */
export function usePatientTenant() {
  const orgId = useStaffAuthStore((s) => s.activeOrganizationId);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  return { orgId, locationId, ready: !!orgId && !!locationId };
}
