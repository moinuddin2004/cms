import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/store/useAuthStore';

import { fetchMyAccess } from '../api/access.api';

export const accessKeys = {
  all: ['access'] as const,
  /** Org AND location are part of the key: switching either refetches. */
  me: (orgId: string | null, locationId: string | null) =>
    ['access', 'me', orgId, locationId] as const,
};

/**
 * The signed-in user's access for the active org + location. Short staleTime
 * plus refetch-on-foreground keeps a role edit reaching the phone; a realtime
 * `access.changed` nudge can invalidate `accessKeys.all` later.
 */
export function useMyAccess(enabled = true) {
  const orgId = useAuthStore((s) => s.activeOrganizationId);
  const locationId = useAuthStore((s) => s.activeLocationId);

  return useQuery({
    queryKey: accessKeys.me(orgId, locationId),
    queryFn: fetchMyAccess,
    enabled: enabled && !!orgId,
    staleTime: 30_000,
  });
}
