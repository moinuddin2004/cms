import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { FinanceDashboardPage } from '@/features/reports'

export const Route = createFileRoute('/finance')({
  staticData: { can: 'finance.overview.view' },
  component: () => (
    <DashboardLayout>
      <FinanceDashboardPage />
    </DashboardLayout>
  ),
})
