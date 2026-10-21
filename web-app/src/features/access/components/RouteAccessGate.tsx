import type { ReactNode } from 'react'
import { useMatches } from '@tanstack/react-router'
import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAccess } from '../hooks/useAccess'
import type { PermissionRequirement } from '../types/access.types'
import { NoAccess } from './NoAccess'

/**
 * The ONE route-level permission check, mounted in `__root`. Every matched
 * route's `staticData.can` must pass (each one is any-of); otherwise the
 * page is replaced by <NoAccess/>. Routes without `staticData.can` pass
 * straight through.
 */
export function RouteAccessGate({ children }: { children: ReactNode }) {
  const matches = useMatches()
  const access = useAccess()

  const required = matches
    .map((m) => m.staticData.can)
    .filter((c): c is PermissionRequirement => c != null)
  if (!required.length) return <>{children}</>

  // Disabled = no location yet: the root redirect is about to move us.
  if (
    access.status === 'loading' ||
    (access.status === 'disabled' && !access.isSuperAdmin)
  ) {
    return (
      <DashboardLayout>
        <LoadingSkeleton variant="detail" />
      </DashboardLayout>
    )
  }
  if (access.status === 'error') {
    return (
      <DashboardLayout>
        <ErrorState
          title="Couldn't load your access"
          onRetry={access.refetch}
        />
      </DashboardLayout>
    )
  }
  if (required.every((perm) => access.can(perm))) return <>{children}</>
  return <NoAccess />
}
