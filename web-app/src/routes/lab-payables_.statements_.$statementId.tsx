import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { RequireRolePage } from '@/components/feature/RequireRolePage'
import { LabStatementDetailPage } from '@/features/lab-payables'

/** Reconcile one lab statement. */
export const Route = createFileRoute('/lab-payables_/statements_/$statementId')(
  {
    component: StatementRoute,
  },
)

function StatementRoute() {
  const { statementId } = Route.useParams()
  return (
    <RequireFeaturePage feature="dental.lab_orders">
      <RequireRolePage roles={['clinic_admin']}>
        <LabStatementDetailPage statementId={statementId} />
      </RequireRolePage>
    </RequireFeaturePage>
  )
}
