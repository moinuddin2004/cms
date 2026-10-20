import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { OrderStatusBadge, toastOrderError } from '@/features/lab-orders'
import { LabOrderActions } from '../components/LabOrderActions'
import { LabOrderView } from '../components/LabOrderView'
import { LabPortalLayout } from '../components/LabPortalLayout'
import {
  useAcknowledgeRevision,
  usePortalNote,
  usePortalOrder,
  usePortalOrderActions,
  usePortalOrderAnswers,
} from '../hooks/usePortalOrders'
import { portalOrdersApi } from '../services/lab-portal-orders.api'

const BACK = { backTo: '/lab-portal/orders', backLabel: 'Back to orders' }

/** One order in the lab portal: the work, and the lab's answers to it. */
export function LabPortalOrderDetailPage({ orderId }: { orderId: string }) {
  const { data: order, isLoading, isError, refetch } = usePortalOrder(orderId)
  const { data: allowed } = usePortalOrderActions(orderId)
  const answers = usePortalOrderAnswers(orderId)
  const acknowledge = useAcknowledgeRevision(orderId)
  const note = usePortalNote(orderId)
  const [body, setBody] = useState('')

  if (isLoading) {
    return (
      <LabPortalLayout title="Order" {...BACK}>
        <LoadingSkeleton variant="cards" />
      </LabPortalLayout>
    )
  }
  if (isError || !order) {
    return (
      <LabPortalLayout title="Order" {...BACK}>
        <ErrorState onRetry={() => void refetch()} />
      </LabPortalLayout>
    )
  }

  const download = async (attachmentId: string) => {
    try {
      const { url } = await portalOrdersApi.attachmentUrl(
        order.id,
        attachmentId,
      )
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      toastOrderError(err)
    }
  }

  return (
    <LabPortalLayout
      title={`Order ${order.orderNo ?? ''}`}
      subtitle={`${order.clinic.name} · ${order.patient.ref}`}
      actions={
        <LabOrderActions
          actions={allowed?.actions ?? []}
          api={answers}
          version={order.version}
          labExpectedOn={order.labExpectedOn}
        />
      }
      {...BACK}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <OrderStatusBadge status={order.status} />
          {order.priority === 'urgent' && (
            <Badge variant="warning">Urgent</Badge>
          )}
          <span className="text-text-3">
            Doctor: {order.doctor?.fullName ?? '—'}
          </span>
          <span className="text-text-3">
            Clinic wants it by: {order.requestedOn ?? '—'}
          </span>
          <span className="text-text-3">
            Ready on: {order.labExpectedOn ?? '—'}
          </span>
        </div>
        <LabOrderView
          order={order}
          onDownload={(id) => void download(id)}
          onAcknowledge={(no) => acknowledge.mutate(no)}
          acknowledging={acknowledge.isPending}
          messageBox={
            <div className="flex items-end gap-2">
              <Textarea
                aria-label="Message the clinic"
                rows={2}
                value={body}
                placeholder="Write to the clinic…"
                onChange={(e) => setBody(e.target.value)}
              />
              <Button
                disabled={!body.trim() || note.isPending}
                onClick={() =>
                  note.mutate(body.trim(), { onSuccess: () => setBody('') })
                }
              >
                {note.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Send
              </Button>
            </div>
          }
        />
      </div>
    </LabPortalLayout>
  )
}
