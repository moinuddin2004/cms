import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { LocationSettingsFeature } from '../LocationSettingsFeature'

/** Settings → Locations → one location's booking, queue and billing rules. */
export function LocationSettingsPage({ locationId }: { locationId: string }) {
  return (
    <DashboardLayout
      title="Location settings"
      subtitle="Booking rules, queue and billing for this location."
      backTo="/settings/locations"
      backLabel="Back to locations"
    >
      <LocationSettingsFeature locationId={locationId} />
    </DashboardLayout>
  )
}
