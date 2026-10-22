import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { UsersPage } from '@/features/users/pages/UsersPage'

export const Route = createFileRoute('/users')({
  staticData: { can: 'admin.users.manage' },
  component: () => (
    <DashboardLayout>
      <UsersPage />
    </DashboardLayout>
  ),
})
