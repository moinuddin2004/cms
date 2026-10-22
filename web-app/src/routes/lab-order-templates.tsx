import { createFileRoute } from '@tanstack/react-router'
import { OrderTemplatesPage } from '@/features/lab-catalog'

/** Saved lab orders — every clinic role (doctors keep their own). */
export const Route = createFileRoute('/lab-order-templates')({
  staticData: { can: 'lab.orders.create' },
  component: () => <OrderTemplatesPage />,
})
