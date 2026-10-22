import { createFileRoute } from '@tanstack/react-router'
import { ReceiveShipmentPage } from '@/features/lab-orders'

/** Where a shipment slip's QR code opens: receive the shipment. */
export const Route = createFileRoute('/lab-orders_/receive/$token')({
  staticData: { can: 'lab.orders.view' },
  component: ReceiveShipmentRoute,
})

function ReceiveShipmentRoute() {
  const { token } = Route.useParams()
  return <ReceiveShipmentPage token={token} />
}
