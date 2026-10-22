import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  bulkSetEntitlement,
  bulkToggleFeatures,
  fetchMyFeatures,
  fetchOrgFeatures,
  seedOrgFlags,
  setEntitlement,
  toggleFeature,
} from '../services/feature-flags.api'
import type {
  ModuleFeatureGroup,
  OrgFeature,
} from '../services/feature-flags.api'

export const FEATURE_FLAGS_QUERY_KEY = 'featureFlags'
export const MY_FEATURES_QUERY_KEY = 'myFeatures'

/**
 * Fetch an org's features grouped by module (super admin view).
 */
export function useOrgFeatures(orgId: string) {
  return useQuery({
    queryKey: [FEATURE_FLAGS_QUERY_KEY, orgId],
    queryFn: () => fetchOrgFeatures(orgId),
  })
}

/**
 * Toggle a single feature with optimistic update.
 */
export function useToggleFeature(orgId: string) {
  const queryClient = useQueryClient()
  const queryKey = [FEATURE_FLAGS_QUERY_KEY, orgId]

  return useMutation({
    mutationFn: ({
      featureKey,
      isEnabled,
    }: {
      featureKey: string
      isEnabled: boolean
    }) => toggleFeature(orgId, featureKey, { isEnabled }),

    // Optimistically flip the toggle
    onMutate: async ({ featureKey, isEnabled }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<ModuleFeatureGroup[]>(queryKey)

      queryClient.setQueryData<ModuleFeatureGroup[]>(queryKey, (old) =>
        old?.map((group) => ({
          ...group,
          features: group.features.map((f) =>
            f.key === featureKey
              ? {
                  ...f,
                  isEnabled,
                  enabled: isEnabled,
                  active: f.entitled && isEnabled,
                }
              : f,
          ),
        })),
      )

      return { previous }
    },

    onError: (_err, _vars, context) => {
      // Revert on failure
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      toast.error('Failed to toggle feature')
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

/**
 * Enable/disable many features at once.
 */
export function useBulkToggleFeatures(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      featureKeys,
      isEnabled,
    }: {
      featureKeys: string[]
      isEnabled: boolean
    }) => bulkToggleFeatures(orgId, { featureKeys, isEnabled }),
    onSuccess: (_data, { isEnabled }) => {
      queryClient.invalidateQueries({
        queryKey: [FEATURE_FLAGS_QUERY_KEY, orgId],
      })
      toast.success(`Features ${isEnabled ? 'enabled' : 'disabled'}`)
    },
    onError: () => toast.error('Failed to update features'),
  })
}

/** Patch one feature in the cached org list. */
function patchFeature(
  groups: ModuleFeatureGroup[] | undefined,
  featureKey: string,
  patch: (f: OrgFeature) => Partial<OrgFeature>,
) {
  return groups?.map((group) => ({
    ...group,
    features: group.features.map((f) =>
      f.key === featureKey ? { ...f, ...patch(f) } : f,
    ),
  }))
}

/**
 * Super admin: entitle (or withdraw) one feature, optionally as a trial
 * until a date. Optimistic.
 */
export function useSetEntitlement(orgId: string) {
  const queryClient = useQueryClient()
  const queryKey = [FEATURE_FLAGS_QUERY_KEY, orgId]

  return useMutation({
    mutationFn: ({
      featureKey,
      entitled,
      until,
    }: {
      featureKey: string
      entitled: boolean
      until?: string | null
    }) => setEntitlement(orgId, featureKey, { entitled, until }),

    onMutate: async ({ featureKey, entitled, until }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<ModuleFeatureGroup[]>(queryKey)
      queryClient.setQueryData<ModuleFeatureGroup[]>(queryKey, (old) =>
        patchFeature(old, featureKey, (f) => ({
          entitled,
          entitledUntil: entitled ? (until ?? null) : null,
          active: entitled && f.enabled,
          lockedReason: entitled ? null : 'not_entitled',
        })),
      )
      return { previous }
    },

    onError: (err: any, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous)
      }
      toast.error(
        err?.response?.data?.message || 'Failed to update entitlement',
      )
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

/** Super admin: entitle (or withdraw) every feature of a module. */
export function useBulkSetEntitlement(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: {
      module?: string
      featureKeys?: string[]
      entitled: boolean
    }) => bulkSetEntitlement(orgId, payload),
    onSuccess: (_data, { entitled }) => {
      queryClient.invalidateQueries({
        queryKey: [FEATURE_FLAGS_QUERY_KEY, orgId],
      })
      toast.success(entitled ? 'Features entitled' : 'Entitlement withdrawn')
    },
    onError: () => toast.error('Failed to update entitlements'),
  })
}

/**
 * Seed default feature flags for an org.
 */
export function useSeedOrgFlags(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => seedOrgFlags(orgId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [FEATURE_FLAGS_QUERY_KEY, orgId],
      })
      toast.success('Default features seeded')
    },
    onError: () => toast.error('Failed to seed features'),
  })
}

/**
 * Fetch the current user's enabled feature keys.
 */
export function useMyFeatures(enabled = true) {
  return useQuery({
    queryKey: [MY_FEATURES_QUERY_KEY],
    queryFn: fetchMyFeatures,
    staleTime: 5 * 60 * 1000, // 5 min
    enabled,
  })
}
