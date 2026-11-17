import { useQuery } from '@tanstack/react-query';

import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { fetchMyAccess } from '../api/access.api';

export const accessKeys = {
  all: ['access'] as const,
  /** Org AND location are part of the key: switching either refetches. The user id is last (audit M1). */
  me: (orgId: string | null, locationId: string | null, userId: string | null = null) =>
    ['access', 'me', orgId, locationId, userId] as const,
};

/**
 * The signed-in user's access for the active org + location. Short staleTime
 * plus refetch-on-foreground keeps a role edit reaching the phone; a realtime
 * `access.changed` nudge can invalidate `accessKeys.all` later.
 */
export function useMyAccess(enabled = true) {
  const orgId = useStaffAuthStore((s) => s.activeOrganizationId);
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  const userId = useStaffAuthStore((s) => s.user?.uuid ?? null);

  return useQuery({
    queryKey: accessKeys.me(orgId, locationId, userId),
    queryFn: fetchMyAccess,
    enabled: enabled && !!orgId,
    staleTime: 30_000,
  });
}
