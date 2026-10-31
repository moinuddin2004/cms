import { createFileRoute } from '@tanstack/react-router'
import { SessionsSettingsPage } from '@/features/settings'

export const Route = createFileRoute('/settings/sessions')({
  component: SessionsSettingsPage,
})
