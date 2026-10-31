import { createFileRoute } from '@tanstack/react-router'
import { LocationsPage } from '@/features/locations/pages/LocationsPage'

export const Route = createFileRoute('/settings/locations/')({
  staticData: { can: 'admin.locations.manage' },
  component: LocationsPage,
})
