import { createFileRoute } from '@tanstack/react-router'
import { NotificationSettingsPage } from '@/features/notifications'

export const Route = createFileRoute('/settings_/notifications')({
  staticData: { can: 'notifications.settings.manage' },
  component: () => <NotificationSettingsPage />,
})
