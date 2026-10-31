import { createFileRoute } from '@tanstack/react-router'
import { SettingsOverviewPage } from '@/features/settings'

export const Route = createFileRoute('/settings/')({
  component: SettingsOverviewPage,
})
