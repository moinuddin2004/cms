import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DoctorRevenuePage } from '@/features/billing'

export const Route = createFileRoute('/billing/doctor-revenue')({
  staticData: { can: 'reports.financial.view' },
  component: () => (
    <DashboardLayout>
      <DoctorRevenuePage />
    </DashboardLayout>
  ),
})
