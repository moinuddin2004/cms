import { createFileRoute } from '@tanstack/react-router'
import { LocationSettingsPage } from '@/features/locations/pages/LocationSettingsPage'

export const Route = createFileRoute('/settings/locations/$id')({
  staticData: { can: 'admin.locations.manage' },
  component: LocationSettingsRoute,
})

function LocationSettingsRoute() {
  const { id } = Route.useParams()
  return <LocationSettingsPage key={id} locationId={id} />
}
