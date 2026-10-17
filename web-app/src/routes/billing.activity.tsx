import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { BillingActivityPage } from '@/features/billing'

export const Route = createFileRoute('/billing/activity')({
  component: () => (
    <RequireFeaturePage feature="billing.invoices">
      <RequireRolePage roles={['clinic_admin']}>
        <DashboardLayout>
          <BillingActivityPage />
        </DashboardLayout>
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
