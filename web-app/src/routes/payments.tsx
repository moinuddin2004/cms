import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PaymentsPage } from '@/features/billing'

export const Route = createFileRoute('/payments')({
  staticData: { can: 'billing.invoice.view' },
  component: () => (
    <DashboardLayout>
      <PaymentsPage />
    </DashboardLayout>
  ),
})
