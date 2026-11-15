import { createFileRoute } from '@tanstack/react-router'
import { VisitStatePage } from '@/features/public-links'

export const Route = createFileRoute('/v/$token')({
  component: RouteComponent,
})

function RouteComponent() {
  const { token } = Route.useParams()
  return <VisitStatePage token={token} />
}
