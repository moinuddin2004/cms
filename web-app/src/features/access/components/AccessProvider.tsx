import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MY_FEATURES_QUERY_KEY } from '@/features/feature-flags/hooks/useFeatureFlags'
import { useAuthStore } from '@/store/useAuthStore'
import { createAccessChecks } from '../lib/access'
import { AccessContext, DISABLED_ACCESS } from '../lib/access-context'
import type { AccessContextValue } from '../lib/access-context'
import { accessKeys, useMyAccess } from '../hooks/useMyAccess'
import { useAccessSocket } from '../hooks/useAccessSocket'
import type { AccessChangedEvent } from '../types/access.types'

/**
 * Loads `/me/access` for the active org + location and serves it through
 * `useAccess()`. Refetches when the API emits `access.changed` for the org
 * (and on window focus as a fallback), so a role edit reaches open tabs
 * without a re-login.
 */
export function AccessProvider({
  children,
  enabled = true,
}: {
  children: ReactNode
  /** Only fetch when authenticated with an active location. */
  enabled?: boolean
}) {
  const queryClient = useQueryClient()
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  const authSuperAdmin = useAuthStore((s) => s.isSuperAdmin)
  const query = useMyAccess(enabled)
  const { data, isPending, isError, refetch } = query
  const currentVersion = data?.version ?? 0

  const onChange = useCallback(
    (event: AccessChangedEvent | null) => {
      // Ignore stale/duplicate nudges; null = reconnected, events may be lost.
      if (event && event.version <= currentVersion) return
      void queryClient.invalidateQueries({ queryKey: accessKeys.org(orgId) })
      // Feature toggles bump the same version — keep the legacy flags in step.
      void queryClient.invalidateQueries({ queryKey: [MY_FEATURES_QUERY_KEY] })
    },
    [queryClient, orgId, currentVersion],
  )
  useAccessSocket(orgId, onChange, enabled)

  const value = useMemo<AccessContextValue>(() => {
    if (!enabled) {
      // No location yet (super-admin setup pages): fall back to the auth
      // store's flag so the admin pages stay reachable.
      if (!authSuperAdmin) return DISABLED_ACCESS
      return {
        ...DISABLED_ACCESS,
        ...createAccessChecks(undefined, { allowAll: true }),
        isSuperAdmin: true,
      }
    }
    return {
      ...createAccessChecks(data),
      status: data ? 'ready' : isError ? 'error' : 'loading',
      isSuperAdmin: data?.isSuperAdmin ?? false,
      isOwner: data?.isOwner ?? false,
      employeeId: data?.employeeId ?? null,
      homeRoute: data?.homeRoute ?? null,
      version: data?.version ?? 0,
      isLoading: isPending,
      isError,
      refetch: () => void refetch(),
    }
  }, [enabled, authSuperAdmin, data, isPending, isError, refetch])

  return (
    <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
  )
}
