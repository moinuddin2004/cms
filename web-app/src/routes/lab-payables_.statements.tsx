import { createFileRoute } from '@tanstack/react-router'
import { LabStatementsPage } from '@/features/lab-payables'

/** Monthly lab statements. */
export const Route = createFileRoute('/lab-payables_/statements')({
  staticData: { can: 'lab.payables.manage' },
  component: () => <LabStatementsPage />,
})
