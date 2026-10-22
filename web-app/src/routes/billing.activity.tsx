import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { BillingActivityPage } from '@/features/billing'

export const Route = createFileRoute('/billing/activity')({
  staticData: { can: 'billing.activity.view' },
  component: () => (
    <DashboardLayout>
      <BillingActivityPage />
    </DashboardLayout>
  ),
})
