import { createFileRoute } from '@tanstack/react-router'
import { VisitStatePage } from '@/features/public-links'

export const Route = createFileRoute('/v/$token')({
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
  return <VisitStatePage token={token} />
}
