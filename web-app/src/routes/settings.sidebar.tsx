import { createFileRoute } from '@tanstack/react-router'
import { NavBuilderPage } from '@/features/nav-builder'

export const Route = createFileRoute('/settings/sidebar')({
  staticData: { can: 'admin.nav.manage' },
  component: NavBuilderPage,
})
