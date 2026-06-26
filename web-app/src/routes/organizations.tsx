import { createFileRoute, Navigate } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { OrganizationsPage } from '@/features/organizations/pages/OrganizationsPage'
import { useAuthStore } from '@/store/useAuthStore'

export const Route = createFileRoute('/organizations')({
  component: OrganizationsRouteComponent,
})

function OrganizationsRouteComponent() {
  const { isSuperAdmin } = useAuthStore()

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" />
  }

  return (
    <DashboardLayout>
      <OrganizationsPage />
    </DashboardLayout>
  )
}
