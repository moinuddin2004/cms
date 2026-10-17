import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { BillingSettingsPage } from '@/features/billing'

export const Route = createFileRoute('/settings_/billing')({
  component: () => (
    <RequireFeaturePage feature="billing.invoices">
      <RequireRolePage roles={['clinic_admin']}>
        <BillingSettingsPage />
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
