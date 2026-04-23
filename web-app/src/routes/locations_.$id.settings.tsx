import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LocationSettingsFeature } from '@/features/locations/LocationSettingsFeature'

export const Route = createFileRoute('/locations_/$id/settings')({
  component: LocationSettingsRouteComponent,
})

function LocationSettingsRouteComponent() {
  const { id } = Route.useParams()

  return (
    <DashboardLayout title="Location Settings">
      <LocationSettingsFeature locationId={id} />
    </DashboardLayout>
  )
}
