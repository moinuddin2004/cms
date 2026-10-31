import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { SessionManagement } from '@/features/auth/components/SessionManagement'

export function SessionsSettingsPage() {
  return (
    <DashboardLayout
      title="Signed-in devices"
      subtitle="Where your account is signed in right now."
    >
      <SessionManagement />
    </DashboardLayout>
  )
}
