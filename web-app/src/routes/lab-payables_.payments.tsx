import { createFileRoute } from '@tanstack/react-router'
import { LabPaymentsPage } from '@/features/lab-payables'

/** Payments to labs. */
export const Route = createFileRoute('/lab-payables_/payments')({
  staticData: { can: 'lab.payables.manage' },
  component: () => <LabPaymentsPage />,
})
