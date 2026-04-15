import { createFileRoute } from '@tanstack/react-router'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'

export const Route = createFileRoute('/forgot-password')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-muted/40 p-4">
      <ForgotPasswordForm />
    </div>
  )
}
