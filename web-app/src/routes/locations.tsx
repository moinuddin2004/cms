import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LocationManagementView } from '@/features/locations/LocationManagementView'
import { useAuthStore } from '@/store/useAuthStore'
import { Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/locations')({
  component: LocationsRouteComponent,
})

function LocationsRouteComponent() {
  const { isSuperAdmin, accessSource } = useAuthStore()

  if (!isSuperAdmin && accessSource !== 'owner') {
    return <Navigate to="/dashboard" />
  }

  return (
    <DashboardLayout title="Locations Management">
      <div className="space-y-4">
        <LocationManagementView />
      </div>
    </DashboardLayout>
  )
}
