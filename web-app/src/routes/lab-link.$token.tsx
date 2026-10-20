import { createFileRoute } from '@tanstack/react-router'
import { MagicLinkOrderPage } from '@/features/lab-portal'

/** No-login lab order page opened from a WhatsApp magic link. */
export const Route = createFileRoute('/lab-link/$token')({
  component: function MagicLinkRoute() {
    const { token } = Route.useParams()
    return <MagicLinkOrderPage token={token} />
  },
})
