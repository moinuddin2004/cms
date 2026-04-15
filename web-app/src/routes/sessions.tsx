import { createFileRoute } from '@tanstack/react-router'
import { SessionManagement } from '@/features/auth/components/SessionManagement'
import { useAuthStore } from '@/store/useAuthStore'
import { Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/sessions')({
  component: RouteComponent,
})

function RouteComponent() {
  const { accessToken } = useAuthStore()

  if (!accessToken) {
      return <Navigate to="/login" />
  }

  return (
    <div className="min-h-screen bg-muted/40 p-8 pt-20">
      <div className="max-w-4xl mx-auto">
        <SessionManagement />
      </div>
    </div>
  )
}
