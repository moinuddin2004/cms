import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { BillingSettingsPage } from '@/features/billing'

// `admin.settings.manage` is a core permission, so the billing feature is
// still checked here.
export const Route = createFileRoute('/settings/billing')({
  staticData: { can: 'admin.settings.manage' },
  component: () => (
    <RequireFeaturePage feature="billing.invoices">
      <BillingSettingsPage />
    </RequireFeaturePage>
  ),
})
