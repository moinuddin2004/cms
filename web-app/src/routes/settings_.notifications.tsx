import { createFileRoute } from '@tanstack/react-router'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { NotificationSettingsPage } from '@/features/notifications'

export const Route = createFileRoute('/settings_/notifications')({
  component: () => (
    <RequireRolePage roles={['clinic_admin']}>
      <NotificationSettingsPage />
    </RequireRolePage>
  ),
})
