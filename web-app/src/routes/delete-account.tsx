import { createFileRoute } from '@tanstack/react-router'
import { DeleteAccountPage } from '@/features/legal'

export const Route = createFileRoute('/delete-account')({
  component: DeleteAccountPage,
})
