import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { OrganizationManagementView } from '@/features/organizations/OrganizationManagementView'

export function OrganizationsPage() {
  const viewRef = useRef<{ create: () => void }>(null)

  return (
    <PageWrapper
      title="Organizations"
      subtitle="Manage clinic organizations and their settings"
      actions={
        <Button onClick={() => viewRef.current?.create()}>
          <Plus className="size-4" />
          Create 
        </Button>
      }
    >
      <OrganizationManagementView ref={viewRef} />
    </PageWrapper>
  )
}
