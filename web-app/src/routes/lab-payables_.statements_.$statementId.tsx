import { createFileRoute } from '@tanstack/react-router'
import { LabStatementDetailPage } from '@/features/lab-payables'

/** Reconcile one lab statement. */
export const Route = createFileRoute('/lab-payables_/statements_/$statementId')(
  {
    staticData: { can: 'lab.payables.manage' },
    component: StatementRoute,
  },
)

function StatementRoute() {
  const { statementId } = Route.useParams()
  return <LabStatementDetailPage statementId={statementId} />
}
