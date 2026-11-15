import { createFileRoute } from '@tanstack/react-router'
import { ClaimLandingPage } from '@/features/public-links'

export const Route = createFileRoute('/c/$token')({
  component: RouteComponent,
})

function RouteComponent() {
  const { token } = Route.useParams()
  return <ClaimLandingPage token={token} />
}
