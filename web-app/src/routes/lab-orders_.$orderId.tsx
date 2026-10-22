import { createFileRoute } from '@tanstack/react-router'
import { LabOrderDetailPage } from '@/features/lab-orders'

/** One lab order. */
export const Route = createFileRoute('/lab-orders_/$orderId')({
  staticData: { can: 'lab.orders.view' },
  component: LabOrderRoute,
})

function LabOrderRoute() {
  const { orderId } = Route.useParams()
  return <LabOrderDetailPage orderId={orderId} />
}
