import { createFileRoute } from '@tanstack/react-router'
import { SettingsLayout } from '@/features/settings'

/** Shell for every settings page (rail + page). */
export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
})
