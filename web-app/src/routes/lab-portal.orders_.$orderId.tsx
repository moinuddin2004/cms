import { createFileRoute } from '@tanstack/react-router'
import { LabPortalOrderDetailPage } from '@/features/lab-portal'

/** One order in the lab portal. */
export const Route = createFileRoute('/lab-portal/orders_/$orderId')({
  component: function LabPortalOrderRoute() {
    const { orderId } = Route.useParams()
    return <LabPortalOrderDetailPage orderId={orderId} />
  },
})
