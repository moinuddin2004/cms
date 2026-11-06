import { createFileRoute } from '@tanstack/react-router'
import { ConfirmLabEmailPage } from '@/features/labs'

/** Public: a lab confirms its contact address from the emailed link. */
export const Route = createFileRoute('/lab-email/confirm')({
  component: () => <ConfirmLabEmailPage />,
})
