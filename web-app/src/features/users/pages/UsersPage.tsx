import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { UserManagementView } from '@/features/users/UserManagementView'
import { useAccess } from '@/features/access'

export function UsersPage() {
  const viewRef = useRef<{ create: () => void }>(null)
  // Only owner / super admin accounts are created here, by owners and super admins.
  const { isSuperAdmin, isOwner } = useAccess()

  return (
    <PageWrapper
      title="User Management"
      subtitle="Manage system access across roles and organizations"
      actions={
        (isSuperAdmin || isOwner) && (
          <Button onClick={() => viewRef.current?.create()}>
            <Plus className="size-4" />
            Create User
          </Button>
        )
      }
    >
      <UserManagementView ref={viewRef} />
    </PageWrapper>
  )
}
