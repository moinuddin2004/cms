import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LocationsPage } from '@/features/locations/pages/LocationsPage'

export const Route = createFileRoute('/locations')({
  staticData: { can: 'admin.locations.manage' },
  component: () => (
    <DashboardLayout>
      <LocationsPage />
    </DashboardLayout>
  ),
})
