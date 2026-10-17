import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { BillingDeskPage } from '@/features/billing'

export const Route = createFileRoute('/billing/')({
  component: () => (
    <RequireFeaturePage feature="billing.invoices">
      <RequireRolePage roles={['clinic_admin', 'receptionist']}>
        <DashboardLayout>
          <BillingDeskPage />
        </DashboardLayout>
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
