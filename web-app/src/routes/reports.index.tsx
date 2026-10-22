import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ReportsHubPage } from '@/features/reports'

export const Route = createFileRoute('/reports/')({
  staticData: { can: ['reports.financial.view', 'reports.clinical.view'] },
  component: () => (
    <DashboardLayout>
      <ReportsHubPage />
    </DashboardLayout>
  ),
})
