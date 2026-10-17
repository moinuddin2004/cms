import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PaymentsPage } from '@/features/billing'

export const Route = createFileRoute('/payments')({
  component: () => (
    <RequireFeaturePage feature="billing.invoices">
      <RequireRolePage roles={['clinic_admin', 'receptionist']}>
        <DashboardLayout>
          <PaymentsPage />
        </DashboardLayout>
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
