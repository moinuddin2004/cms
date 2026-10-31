import { createFileRoute } from '@tanstack/react-router'
import { FeatureSettingsPage } from '@/features/feature-settings'

export const Route = createFileRoute('/settings/features')({
  staticData: { can: 'admin.features.manage' },
  component: FeatureSettingsPage,
})
