import { createFileRoute } from '@tanstack/react-router'
import { MyNotificationsPage } from '@/features/notifications'

/** Any signed-in user: their own email switches and the bell sound. */
export const Route = createFileRoute('/settings/my-notifications')({
  component: () => <MyNotificationsPage />,
})
