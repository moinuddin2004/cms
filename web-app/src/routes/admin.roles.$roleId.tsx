import { createFileRoute } from '@tanstack/react-router'
import { RoleDetailPage } from '@/features/roles'

export const Route = createFileRoute('/admin/roles/$roleId')({
  staticData: { can: 'admin.roles.manage' },
  component: RoleDetailRoute,
})

function RoleDetailRoute() {
  const { roleId } = Route.useParams()
  return <RoleDetailPage key={roleId} roleId={roleId} />
}
