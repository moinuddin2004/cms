import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useAuthStore } from '@/store/useAuthStore'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

function DashboardComponent() {
  const { accessToken, user } = useAuthStore()

  if (!accessToken) {
      return <Navigate to="/login" />
  }

  return (
    <div className="min-h-screen bg-muted/40 p-8 pt-20">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {user?.name || 'Administrator'}.</p>
        </div>
      </div>
    </div>
  )
}
