import { Link } from '@tanstack/react-router'
import { ShieldOff } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { useAccess } from '../hooks/useAccess'

/** Full-page "no permission" state for a route the user can't open. */
export function NoAccess() {
  const { homeRoute } = useAccess()
  return (
    <DashboardLayout title="No access">
      <EmptyState
        icon={ShieldOff}
        title="You have no access to this page"
        description="You don't have permission to open this page. Ask your clinic owner to add it to your role."
        action={
          <Button asChild>
            <Link to={homeRoute ?? '/dashboard'}>Go to my home page</Link>
          </Button>
        }
      />
    </DashboardLayout>
  )
}
