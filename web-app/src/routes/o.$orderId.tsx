import { createFileRoute } from '@tanstack/react-router'
import { OrderQrPage } from '@/features/lab-portal'

/** Work-order QR target: lab members → portal order, clinic staff → clinic order. */
export const Route = createFileRoute('/o/$orderId')({
  component: function OrderQrRoute() {
    const { orderId } = Route.useParams()
    return <OrderQrPage orderId={orderId} />
  },
})
