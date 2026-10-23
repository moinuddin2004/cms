import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ClinicOverviewPage } from '@/features/reports'

export const Route = createFileRoute('/clinic-overview')({
  staticData: { can: 'reports.clinical.view' },
  component: () => (
    <DashboardLayout>
      <ClinicOverviewPage />
    </DashboardLayout>
  ),
})
