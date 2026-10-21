import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  REPORTS_CLINICAL_FEATURE,
  REPORTS_FEATURE,
  ReportsHubPage,
} from '@/features/reports'

export const Route = createFileRoute('/reports/')({
  component: () => (
    <RequireFeaturePage feature={[REPORTS_FEATURE, REPORTS_CLINICAL_FEATURE]}>
      <RequireRolePage roles={['clinic_admin']}>
        <DashboardLayout>
          <ReportsHubPage />
        </DashboardLayout>
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
