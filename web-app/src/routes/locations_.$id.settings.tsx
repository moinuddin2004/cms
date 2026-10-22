import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LocationSettingsFeature } from '@/features/locations/LocationSettingsFeature'

export const Route = createFileRoute('/locations_/$id/settings')({
  staticData: { can: 'admin.locations.manage' },
  component: LocationSettingsRouteComponent,
})

function LocationSettingsRouteComponent() {
  const { id } = Route.useParams()

  return (
    <DashboardLayout
      title="Location Settings"
      backTo="/locations"
      backLabel="Back to locations"
    >
      <LocationSettingsFeature locationId={id} />
    </DashboardLayout>
  )
}
