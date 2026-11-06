import { createFileRoute } from '@tanstack/react-router'
import { ConfirmEmailPage } from '@/features/account'

export const Route = createFileRoute('/confirm-email')({
  component: () => <ConfirmEmailPage />,
})
