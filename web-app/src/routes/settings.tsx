import { createFileRoute, Navigate } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'
import { useAuthStore } from '@/store/useAuthStore'

export const Route = createFileRoute('/settings')({
  component: SettingsRouteComponent,
})

function SettingsRouteComponent() {
  const { accessToken } = useAuthStore()

  if (!accessToken) {
    return <Navigate to="/login" />
  }

  return (
    <DashboardLayout>
      <SettingsPage />
    </DashboardLayout>
  )
}
