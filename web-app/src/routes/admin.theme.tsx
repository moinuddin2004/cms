import { createFileRoute } from '@tanstack/react-router'
import { ThemeBuilderPage } from '@/features/theme'

export const Route = createFileRoute('/admin/theme')({
  staticData: { can: 'admin.theme.manage' },
  component: ThemeBuilderPage,
})
