import { useRef, useState } from 'react'
import { Loader2, Paperclip, Receipt, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ErrorState, LoadingSkeleton, StatusBadge } from '@/components/shared'
import { formatMinor } from '@/features/lab-catalog'
import { OrderStatusBadge, toastOrderError } from '@/features/lab-orders'
import {
  CHARGE_KIND_LABEL,
  ChargeRequestSheet,
} from '../components/ChargeRequestSheet'
import { LabOrderActions } from '../components/LabOrderActions'
import { LabOrderView, OrderSection } from '../components/LabOrderView'
import { LabPortalLayout } from '../components/LabPortalLayout'
import { useActiveLab } from '../hooks/useLabPortal'
import {
  useAcknowledgeRevision,
  usePortalChargeRequest,
  usePortalNote,
  usePortalUpload,
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
  const charge = usePortalChargeRequest(orderId)
  const upload = usePortalUpload(orderId)
  const { isLabAdmin } = useActiveLab()
  const [body, setBody] = useState('')
  const [charging, setCharging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

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
        <div className="flex flex-wrap gap-2">
          {isLabAdmin && (
            <Button variant="outline" onClick={() => setCharging(true)}>
              <Receipt className="size-4" /> Request charge
            </Button>
          )}
          <LabOrderActions
            actions={allowed?.actions ?? []}
            api={answers}
            version={order.version}
            labExpectedOn={order.labExpectedOn}
          />
        </div>
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
          filesAction={
            <>
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                accept="image/*,application/pdf,.stl,.ply,.obj,.zip"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) upload.mutate(file)
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={upload.isPending}
                onClick={() => fileInput.current?.click()}
              >
                {upload.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Paperclip className="size-4" />
                )}
                Upload file
              </Button>
            </>
          }
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
        {!!order.charges?.length && (
          <OrderSection title="Extra charges">
            <ul className="space-y-2 text-sm">
              {order.charges.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <span>
                    {(CHARGE_KIND_LABEL as Record<string, string | undefined>)[
                      c.kind
                    ] ?? c.kind}{' '}
                    · {formatMinor(c.amountMinor)}
                    <span className="block text-xs text-text-3">
                      {c.reason}
                      {c.decisionNote && ` — clinic: ${c.decisionNote}`}
                    </span>
                  </span>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          </OrderSection>
        )}
      </div>
      <ChargeRequestSheet
        open={charging}
        items={order.items}
        onOpenChange={setCharging}
        onSubmit={(b) => charge.mutateAsync(b)}
      />
    </LabPortalLayout>
  )
}
