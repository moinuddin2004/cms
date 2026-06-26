import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { LocationManagementView } from '@/features/locations/LocationManagementView'

export function LocationsPage() {
  const viewRef = useRef<{ create: () => void }>(null)

  return (
    <PageWrapper
      title="Locations"
      subtitle="Manage clinic locations and their settings"
      actions={
        <Button onClick={() => viewRef.current?.create()}>
          <Plus className="size-4" />
          Create Location
        </Button>
      }
    >
      <LocationManagementView ref={viewRef} />
    </PageWrapper>
  )
}
