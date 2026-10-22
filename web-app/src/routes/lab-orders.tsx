import { createFileRoute } from '@tanstack/react-router'
import { LabOrdersPage } from '@/features/lab-orders'

/** The clinic's lab orders — every clinic role. */
export const Route = createFileRoute('/lab-orders')({
  staticData: { can: 'lab.orders.view' },
  component: () => <LabOrdersPage />,
})
