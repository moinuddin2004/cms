import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DoctorEarningsPage } from '@/features/billing'

export const Route = createFileRoute('/billing/doctor-earnings')({
  staticData: { can: 'earnings.all.view' },
  component: () => (
    <DashboardLayout>
      <DoctorEarningsPage />
    </DashboardLayout>
  ),
})
