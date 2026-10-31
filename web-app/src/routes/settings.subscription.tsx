import { createFileRoute } from '@tanstack/react-router'
import { SubscriptionPage } from '@/features/account'

export const Route = createFileRoute('/settings/subscription')({
  component: () => <SubscriptionPage />,
})
