import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { ReceiveShipmentPage } from '@/features/lab-orders'

/** Where a shipment slip's QR code opens: receive the shipment. */
export const Route = createFileRoute('/lab-orders_/receive/$token')({
  component: ReceiveShipmentRoute,
})

function ReceiveShipmentRoute() {
  const { token } = Route.useParams()
  return (
    <RequireFeaturePage feature="dental.lab_orders">
      <ReceiveShipmentPage token={token} />
    </RequireFeaturePage>
  )
}
