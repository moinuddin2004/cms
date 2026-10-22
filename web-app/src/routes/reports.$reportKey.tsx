import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ReportViewerPage } from '@/features/reports'

// Each report also needs its own permission (financial / clinical): the
// API answers 403 for the other kind, shown by the viewer's error state.
export const Route = createFileRoute('/reports/$reportKey')({
  staticData: { can: ['reports.financial.view', 'reports.clinical.view'] },
  component: ReportRoute,
})

function ReportRoute() {
  const { reportKey } = Route.useParams()
  return (
    <DashboardLayout>
      <ReportViewerPage key={reportKey} reportKey={reportKey} />
    </DashboardLayout>
  )
}
