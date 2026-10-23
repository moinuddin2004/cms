import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { MyEarningsPage } from '@/features/billing'

export const Route = createFileRoute('/my-earnings')({
  staticData: { can: 'earnings.own.view' },
  component: () => (
    <DashboardLayout>
      <MyEarningsPage />
    </DashboardLayout>
  ),
})
