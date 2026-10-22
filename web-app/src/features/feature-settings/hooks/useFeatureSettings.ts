import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { accessKeys } from '@/features/access'
import { useAuthStore } from '@/store/useAuthStore'
import {
  fetchFeatureImpact,
  fetchOwnerFeatures,
  setFeatureEnabled,
  setLocationFeatureDisabled,
} from '../services/feature-settings.api'
import type { OwnerFeaturesView } from '../types/feature-settings.types'

export const featureSettingsKeys = {
  all: ['featureSettings'] as const,
  list: (orgId: string | null) => ['featureSettings', orgId] as const,
  impact: (orgId: string | null, key: string) =>
    ['featureSettings', orgId, 'impact', key] as const,
}

/** The API's message for a failed request (403 bodies nest it under `error`). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (
    err as {
      response?: {
        data?: { message?: unknown; error?: { message?: unknown } }
      }
    }
  ).response?.data
  const msg = data?.error?.message ?? data?.message
  return typeof msg === 'string' && msg ? msg : fallback
}

/** `GET /admin/features` for the active org. */
export function useOwnerFeatures() {
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  return useQuery({
    queryKey: featureSettingsKeys.list(orgId),
    queryFn: fetchOwnerFeatures,
    enabled: !!orgId,
  })
}

/** What turning `featureKey` off takes away (fetched while the confirm is open). */
export function useFeatureImpact(featureKey: string | null) {
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  return useQuery({
    queryKey: featureSettingsKeys.impact(orgId, featureKey ?? ''),
    queryFn: () => fetchFeatureImpact(featureKey!),
    enabled: !!orgId && !!featureKey,
  })
}

function useRefreshAfterChange() {
  const queryClient = useQueryClient()
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  return () => {
    void queryClient.invalidateQueries({
      queryKey: featureSettingsKeys.list(orgId),
    })
    // The org's features drive /me/access (sidebar, route guards).
    void queryClient.invalidateQueries({ queryKey: accessKeys.org(orgId) })
    void queryClient.invalidateQueries({ queryKey: ['myFeatures'] })
  }
}

/** Owner's org-wide switch, applied optimistically. */
export function useSetFeatureEnabled() {
  const queryClient = useQueryClient()
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  const refresh = useRefreshAfterChange()
  const listKey = featureSettingsKeys.list(orgId)

  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      setFeatureEnabled(key, enabled),
    onMutate: async ({ key, enabled }) => {
      await queryClient.cancelQueries({ queryKey: listKey })
      const previous = queryClient.getQueryData<OwnerFeaturesView>(listKey)
      queryClient.setQueryData<OwnerFeaturesView>(listKey, (old) =>
        old
          ? {
              ...old,
              modules: old.modules.map((m) => ({
                ...m,
                features: m.features.map((f) =>
                  f.key === key
                    ? { ...f, enabled, active: f.entitled && enabled }
                    : f,
                ),
              })),
            }
          : old,
      )
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous)
      toast.error(apiErrorMessage(err, 'Could not change the feature'))
    },
    onSuccess: (_data, { enabled }) => {
      toast.success(enabled ? 'Feature turned on' : 'Feature turned off')
    },
    onSettled: refresh,
  })
}

/** Switch a feature off (or back to the clinic setting) at one location. */
export function useSetLocationFeature() {
  const refresh = useRefreshAfterChange()
  return useMutation({
    mutationFn: ({
      key,
      locationId,
      disabled,
    }: {
      key: string
      locationId: string
      disabled: boolean
    }) => setLocationFeatureDisabled(key, locationId, disabled),
    onSuccess: () => {
      toast.success('Location setting saved')
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Could not save the location setting'))
    },
    onSettled: refresh,
  })
}
