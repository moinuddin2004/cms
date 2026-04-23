import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm'

export const Route = createFileRoute('/reset-password')({
  component: RouteComponent,
})

function RouteComponent() {
  return <ResetPasswordForm />
}
