import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'
import { fetchMyAccess } from '../services/access.api'

export const accessKeys = {
  all: ['access'] as const,
  /** Everything cached for one org (any location) — used by invalidation. */
  org: (orgId: string | null) => ['access', 'me', orgId] as const,
  /** Org AND location are part of the key: switching either refetches. */
  me: (orgId: string | null, locationId: string | null) =>
    ['access', 'me', orgId, locationId] as const,
}

/**
 * The signed-in user's resolved access for the active org + location.
 * A short staleTime plus refetch-on-focus is the fallback for when the
 * realtime `access.changed` nudge can't reach this tab.
 */
export function useMyAccess(enabled = true) {
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  const locationId = useAuthStore((s) => s.activeLocationId)

  return useQuery({
    queryKey: accessKeys.me(orgId, locationId),
    queryFn: fetchMyAccess,
    enabled: enabled && !!orgId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}
