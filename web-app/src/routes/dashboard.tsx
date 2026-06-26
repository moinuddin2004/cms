import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useAuthStore } from '@/store/useAuthStore'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
})

function DashboardComponent() {
  const { accessToken } = useAuthStore()
  if (!accessToken) return <Navigate to="/login" />

  return (
    <DashboardLayout>
      <DashboardPage />
    </DashboardLayout>
  )
}
