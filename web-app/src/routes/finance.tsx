import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { FinanceDashboardPage, REPORTS_FEATURE } from '@/features/reports'

export const Route = createFileRoute('/finance')({
  component: () => (
    <RequireFeaturePage feature={REPORTS_FEATURE}>
      <RequireRolePage roles={['clinic_admin']}>
        <DashboardLayout>
          <FinanceDashboardPage />
        </DashboardLayout>
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
