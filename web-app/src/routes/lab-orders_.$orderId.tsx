import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { LabOrderDetailPage } from '@/features/lab-orders'

/** One lab order. */
export const Route = createFileRoute('/lab-orders_/$orderId')({
  component: LabOrderRoute,
})

function LabOrderRoute() {
  const { orderId } = Route.useParams()
  return (
    <RequireFeaturePage feature="dental.lab_orders">
      <LabOrderDetailPage orderId={orderId} />
    </RequireFeaturePage>
  )
}
