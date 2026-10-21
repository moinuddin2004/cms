import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  ClinicOverviewPage,
  REPORTS_CLINICAL_FEATURE,
} from '@/features/reports'

export const Route = createFileRoute('/clinic-overview')({
  component: () => (
    <RequireFeaturePage feature={REPORTS_CLINICAL_FEATURE}>
      <RequireRolePage roles={['clinic_admin']}>
        <DashboardLayout>
          <ClinicOverviewPage />
        </DashboardLayout>
      </RequireRolePage>
    </RequireFeaturePage>
  ),
})
