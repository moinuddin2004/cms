import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  REPORTS_CLINICAL_FEATURE,
  REPORTS_FEATURE,
  ReportViewerPage,
} from '@/features/reports'

export const Route = createFileRoute('/reports/$reportKey')({
  component: ReportRoute,
})

function ReportRoute() {
  const { reportKey } = Route.useParams()
  return (
    <RequireFeaturePage feature={[REPORTS_FEATURE, REPORTS_CLINICAL_FEATURE]}>
      <RequireRolePage roles={['clinic_admin']}>
        <DashboardLayout>
          <ReportViewerPage key={reportKey} reportKey={reportKey} />
        </DashboardLayout>
      </RequireRolePage>
    </RequireFeaturePage>
  )
}
