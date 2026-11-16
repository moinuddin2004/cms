import { createFileRoute } from '@tanstack/react-router'
import { ClaimLandingPage } from '@/features/public-links'

export const Route = createFileRoute('/c/$token')({
  // The URL carries a bearer token: keep it out of search engines and Referer.
  head: () => ({
    meta: [
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { token } = Route.useParams()
  return <ClaimLandingPage token={token} />
}
