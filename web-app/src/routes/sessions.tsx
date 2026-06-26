import { createFileRoute, Navigate } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { SessionManagement } from '@/features/auth/components/SessionManagement'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { useAuthStore } from '@/store/useAuthStore'

export const Route = createFileRoute('/sessions')({
  component: SessionsRouteComponent,
})

function SessionsRouteComponent() {
  const { accessToken } = useAuthStore()

  if (!accessToken) {
    return <Navigate to="/login" />
  }

  return (
    <DashboardLayout>
      <PageWrapper
        title="Active Sessions"
      />
      <div className="mx-auto mt-5 max-w-4xl">
        <SessionManagement />
      </div>
    </DashboardLayout>
  )
}
