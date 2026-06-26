import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { InvoicesPage } from '@/features/billing/pages/InvoicesPage'

export const Route = createFileRoute('/invoices/')({
  component: () => (
    <RequireFeaturePage feature="billing.invoices">
      <DashboardLayout>
        <InvoicesPage />
      </DashboardLayout>
    </RequireFeaturePage>
  ),
})
