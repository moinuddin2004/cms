import type { ReactNode } from 'react'
import { formatInClinic } from '@/lib/datetime'
import { PackageCheck } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ReceiveShipmentForm } from '../components/production/ReceiveShipmentForm'
import {
  useProductionMutation,
  useShipmentByToken,
} from '../hooks/useProduction'
import { productionApi } from '../services/production.api'
import { SHIPMENT_STATUS_LABEL } from '../production.types'
import type { ReceiveLineInput } from '../production.types'

/**
 * Where the shipment slip's QR code lands (lab ERD §5b "QR token"): the
 * open lines, ready to receive in one go. Status changes are recorded as
 * coming through a QR scan.
 */
export function ReceiveShipmentPage({ token }: { token: string }) {
  const navigate = useNavigate()
  const {
    data: shipment,
    isLoading,
    isError,
    refetch,
  } = useShipmentByToken(token)
  const receive = useProductionMutation(
    (lines: ReceiveLineInput[]) =>
      productionApi.receive(shipment!.id, { lines, viaQr: true }),
    'Shipment received',
  )

  const layout = (body: ReactNode) => (
    <DashboardLayout
      title={shipment ? `Receive ${shipment.shipmentNo}` : 'Receive shipment'}
      subtitle={shipment ? `From ${shipment.lab.name}` : undefined}
      backTo="/lab-orders"
      backLabel="Back to lab orders"
    >
      {body}
    </DashboardLayout>
  )

  if (isLoading) return layout(<LoadingSkeleton variant="cards" />)
  if (isError || !shipment) {
    return layout(<ErrorState onRetry={() => void refetch()} />)
  }
  const open = shipment.lines.filter((l) => !l.condition)
  const orders = [...new Set(shipment.lines.map((l) => l.orderId))]
  if (shipment.direction !== 'to_clinic' || open.length === 0) {
    return layout(
      <EmptyState
        icon={PackageCheck}
        title={`Nothing left to receive (${SHIPMENT_STATUS_LABEL[shipment.status]})`}
        description="Every line of this shipment has been recorded."
        action={
          orders.length === 1 ? (
            <Button asChild>
              <Link to="/lab-orders/$orderId" params={{ orderId: orders[0] }}>
                Open the order
              </Link>
            </Button>
          ) : undefined
        }
      />,
    )
  }
  return layout(
    <div className="max-w-3xl space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-sm text-text-2">
        {shipment.courierName ?? 'No courier'}
        {shipment.trackingNo && ` #${shipment.trackingNo}`} · dispatched{' '}
        {formatInClinic(shipment.dispatchedAt, 'dd/MM/yyyy, HH:mm')}
      </p>
      <ReceiveShipmentForm
        shipment={shipment}
        submitLabel="Receive shipment"
        onSubmit={async (lines) => {
          await receive.mutateAsync(lines)
          if (orders.length === 1) {
            void navigate({
              to: '/lab-orders/$orderId',
              params: { orderId: orders[0] },
              replace: true,
            })
          }
        }}
      />
    </div>,
  )
}
