import { createFileRoute, Navigate } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LocationsPage } from '@/features/locations/pages/LocationsPage'
import { useAuthStore } from '@/store/useAuthStore'

export const Route = createFileRoute('/locations')({
  component: LocationsRouteComponent,
})

function LocationsRouteComponent() {
  const { isSuperAdmin, accessSource } = useAuthStore()

  if (!isSuperAdmin && accessSource !== 'owner') {
    return <Navigate to="/dashboard" />
  }

  return (
    <DashboardLayout>
      <LocationsPage />
    </DashboardLayout>
  )
}
