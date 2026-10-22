import { createFileRoute } from '@tanstack/react-router'
import { PayablesReportsPage } from '@/features/lab-payables'

/** Payables aging, lab cost per month, case profit. */
export const Route = createFileRoute('/lab-payables_/reports')({
  staticData: { can: 'lab.payables.manage' },
  component: () => <PayablesReportsPage />,
})
