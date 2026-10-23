import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { BillingDeskPage } from '@/features/billing'

export const Route = createFileRoute('/billing/')({
  staticData: { can: 'billing.desk.use' },
  component: () => (
    <DashboardLayout>
      <BillingDeskPage />
    </DashboardLayout>
  ),
})
