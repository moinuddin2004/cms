import { createFileRoute } from '@tanstack/react-router'
import { RegisterForm } from '@/features/auth/components/RegisterForm'

export const Route = createFileRoute('/register')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-muted/40 p-4">
      <RegisterForm />
    </div>
  )
}
