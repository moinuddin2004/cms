import { createFileRoute } from '@tanstack/react-router'
import { SecuritySettingsPage } from '@/features/settings'

export const Route = createFileRoute('/settings/security')({
  component: SecuritySettingsPage,
})
