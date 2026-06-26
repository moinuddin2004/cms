import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { UsersPage } from '@/features/users/pages/UsersPage'

export const Route = createFileRoute('/users')({
  component: () => (
    <DashboardLayout>
      <UsersPage />
    </DashboardLayout>
  ),
})
