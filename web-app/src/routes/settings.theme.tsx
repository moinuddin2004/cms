import { createFileRoute } from '@tanstack/react-router'
import { ThemeBuilderPage } from '@/features/theme'

export const Route = createFileRoute('/settings/theme')({
  staticData: { can: 'admin.theme.manage' },
  component: ThemeBuilderPage,
})
