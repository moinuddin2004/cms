import { createFileRoute } from '@tanstack/react-router'
import { JoinInvitePage } from '@/features/auth/pages/JoinInvitePage'

export const Route = createFileRoute('/join/$token')({
  component: RouteComponent,
})

function RouteComponent() {
  const { token } = Route.useParams()
  return <JoinInvitePage token={token} />
}
