import { Navigate } from '@tanstack/react-router'
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAccess } from '../hooks/useAccess'
import { useHomeRoute } from '../hooks/useHomeRoute'
import { DEFAULT_HOME_ROUTE } from '../nav/homeRoute'

/**
 * `/` — the one place "no explicit destination" is decided. Login, location
 * selection and the root guard send the user here; it forwards to their home
 * page (role → clinic layout → `/dashboard`) once `/me/access` is known.
 */
export function HomeRedirect() {
  const access = useAccess()
  const home = useHomeRoute()

  if (access.status === 'loading') {
    return (
      <DashboardLayout>
        <LoadingSkeleton variant="detail" />
      </DashboardLayout>
    )
  }
  // Not signed in / no location (dashboard redirects on) or access failed.
  const to = access.status === 'ready' ? home : DEFAULT_HOME_ROUTE
  return <Navigate to={to} replace />
}
