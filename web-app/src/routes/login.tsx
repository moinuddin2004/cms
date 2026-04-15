import { createFileRoute } from '@tanstack/react-router'
import { LoginForm } from '@/features/auth/components/LoginForm'

export const Route = createFileRoute('/login')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-muted/40 p-4">
      <LoginForm />
    </div>
  )
}
