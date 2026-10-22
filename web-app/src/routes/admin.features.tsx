import { createFileRoute } from '@tanstack/react-router'
import { FeatureSettingsPage } from '@/features/feature-settings'

export const Route = createFileRoute('/admin/features')({
  staticData: { can: 'admin.features.manage' },
  component: FeatureSettingsPage,
})
