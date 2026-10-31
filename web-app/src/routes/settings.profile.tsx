import { createFileRoute } from '@tanstack/react-router'
import { ProfileSettingsPage } from '@/features/settings'

export const Route = createFileRoute('/settings/profile')({
  component: ProfileSettingsPage,
})
