import { createFileRoute } from '@tanstack/react-router'
import { UsersPage } from '@/features/users/pages/UsersPage'

export const Route = createFileRoute('/settings/users')({
  staticData: { can: 'admin.users.manage' },
  component: UsersPage,
})
