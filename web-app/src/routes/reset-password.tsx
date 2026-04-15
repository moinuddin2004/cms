import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm'

export const Route = createFileRoute('/reset-password')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-muted/40 p-4">
      <ResetPasswordForm />
    </div>
  )
}
