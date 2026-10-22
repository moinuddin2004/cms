import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { InvoicesPage } from '@/features/billing'

export const Route = createFileRoute('/invoices/')({
  staticData: { can: 'billing.invoice.view' },
  component: () => (
    <DashboardLayout>
      <InvoicesPage />
    </DashboardLayout>
  ),
})
