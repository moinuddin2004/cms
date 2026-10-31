import { createFileRoute } from '@tanstack/react-router'
import { RolesPage } from '@/features/roles'

export const Route = createFileRoute('/settings/roles/')({
  staticData: { can: 'admin.roles.manage' },
  component: RolesPage,
})
