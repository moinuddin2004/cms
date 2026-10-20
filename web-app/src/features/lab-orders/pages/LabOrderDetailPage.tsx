import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  Download,
  FileText,
  Loader2,
  Pencil,
  Printer,
  Repeat,
  Send,
  X,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ErrorState, FormSelect, LoadingSkeleton } from '@/components/shared'
import { FileUploadField } from '@/components/shared/FileUploadField'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { formatPaisa } from '@/features/lab-catalog'
import { LabBillingPanel } from '@/features/lab-billing'
import { LabAccessPanel } from '../components/LabAccessPanel'
import { LabOrderSheet } from '../components/LabOrderSheet'
import { ItemStatusBadge, OrderStatusBadge } from '../components/order-badges'
import { printWorkOrder } from '../components/print-work-order'
import { ReasonDialog } from '../components/ReasonDialog'
import { RevisionSheet } from '../components/RevisionSheet'
import { ProductionPanel } from '../components/production/ProductionPanel'
import { useLabOrder, useOrderMutation } from '../hooks/useLabOrders'
import { toastOrderError } from '../lib/order-errors'
import { labOrdersApi, newIdempotencyKey } from '../services/lab-orders.api'
import type { LabOrderDetail, OrderAttachment } from '../types'
import { statusLabel } from '../types'

/** Status actions with a confirm + reason (the workflow requires one). */
const ACTION_COPY: Partial<
  Record<string, { label: string; destructive?: boolean }>
> = {
  cancel: { label: 'Cancel order', destructive: true },
  hold: { label: 'Put on hold' },
  resume: { label: 'Resume' },
  reopen: { label: 'Reopen as draft' },
}

/** How a status change reached us (lab ERD §7). */
const VIA_LABEL: Record<string, string> = {
  portal: 'lab portal',
  magic_link: 'WhatsApp link',
  proxy: 'entered by clinic for the lab',
  qr: 'QR scan',
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** One lab order: what was asked, prices, conversation, files and history. */
export function LabOrderDetailPage({ orderId }: { orderId: string }) {
  const navigate = useNavigate()
  const { data: order, isLoading, isError, refetch } = useLabOrder(orderId)
  const [editing, setEditing] = useState(false)
  const [revising, setRevising] = useState(false)
  const [action, setAction] = useState<string | null>(null)
  const submitKey = useRef(newIdempotencyKey())

  const submit = useOrderMutation(
    (o: LabOrderDetail) =>
      labOrdersApi.submit(o.id, o.version, submitKey.current),
    {
      success: (o) => {
        submitKey.current = newIdempotencyKey()
        return `Order ${o.orderNo ?? ''} sent to ${o.lab.name}`
      },
    },
  )
  const transition = useOrderMutation(
    (v: { action: string; reason: string }) =>
      labOrdersApi.transition(orderId, { ...v, version: order!.version }),
    { success: (o) => `Order is now ${statusLabel(o.status).toLowerCase()}` },
  )
  const repeat = useOrderMutation(() => labOrdersApi.repeat(orderId), {
    success: 'Copied into a new draft',
  })

  if (isLoading) {
    return (
      <DashboardLayout
        title="Lab order"
        backTo="/lab-orders"
        backLabel="Back to lab orders"
      >
        <LoadingSkeleton variant="cards" />
      </DashboardLayout>
    )
  }
  if (isError || !order) {
    return (
      <DashboardLayout
        title="Lab order"
        backTo="/lab-orders"
        backLabel="Back to lab orders"
      >
        <ErrorState onRetry={() => void refetch()} />
      </DashboardLayout>
    )
  }

  const isDraft = order.status === 'draft'
  const chosen = action ? ACTION_COPY[action] : undefined
  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {isDraft ? (
        <>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Edit draft
          </Button>
          <Button
            disabled={submit.isPending}
            onClick={() => submit.mutate(order)}
          >
            {submit.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Submit to lab
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="outline"
            onClick={() => void printWorkOrder(order.id).catch(toastOrderError)}
          >
            <Printer className="size-4" /> Work order
          </Button>
          {[
            'submitted',
            'clarification_needed',
            'accepted',
            'in_progress',
            'on_hold',
          ].includes(order.status) && (
            <Button variant="outline" onClick={() => setRevising(true)}>
              <FileText className="size-4" /> Revise
            </Button>
          )}
          <Button
            variant="outline"
            disabled={repeat.isPending}
            onClick={() =>
              repeat.mutate(undefined, {
                onSuccess: (d) =>
                  void navigate({
                    to: '/lab-orders/$orderId',
                    params: { orderId: d.id },
                  }),
              })
            }
          >
            {repeat.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Repeat className="size-4" />
            )}
            Repeat
          </Button>
        </>
      )}
      {order.availableActions.map((a) => {
        const copy = ACTION_COPY[a]
        return copy ? (
          <Button
            key={a}
            variant={copy.destructive ? 'destructive' : 'outline'}
            onClick={() => setAction(a)}
          >
            {copy.label}
          </Button>
        ) : null
      })}
    </div>
  )

  return (
    <DashboardLayout
      title={order.orderNo ? `Lab order ${order.orderNo}` : 'Draft lab order'}
      subtitle={`${order.patient.fullName} · ${order.lab.name}`}
      backTo="/lab-orders"
      backLabel="Back to lab orders"
      actions={actions}
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
            Due back: {order.labExpectedOn ?? order.requestedOn ?? '—'}
          </span>
          {order.currentRevisionNo > 0 && (
            <span className="text-text-3">
              Revision {order.currentRevisionNo}
            </span>
          )}
        </div>

        {order.warnings.map((w) => (
          <p
            key={w.code}
            className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <AlertTriangle className="size-4 shrink-0" /> {w.message}
          </p>
        ))}

        <Section
          title="Items"
          action={
            order.totals && (
              <span className="text-sm tabular-nums text-text-2">
                Lab {formatPaisa(order.totals.labCostPaisa)} · Patient{' '}
                {formatPaisa(order.totals.patientPricePaisa)}
              </span>
            )
          }
        >
          <div className="space-y-3">
            {order.items.map((i) => (
              <div key={i.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {i.lineNo}. {i.serviceName} × {i.quantity}
                      {i.rush ? ' · Rush' : ''}
                    </p>
                    {i.options && i.options.length > 0 && (
                      <p className="text-xs text-text-3">
                        {i.options.map((o) => o.name).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {i.prices && (
                      <span className="text-sm tabular-nums">
                        {formatPaisa(i.prices.labLineCostPaisa)}
                        <span className="text-xs text-text-3">
                          {' '}
                          · patient{' '}
                          {formatPaisa(i.prices.patientLinePricePaisa)}
                        </span>
                      </span>
                    )}
                    <ItemStatusBadge status={i.status} />
                  </div>
                </div>
                {i.teeth.length > 0 && (
                  <p className="mt-2 text-xs text-text-2">
                    Teeth:{' '}
                    {i.teeth
                      .map((t) =>
                        t.role && t.role !== 'crown'
                          ? `${t.tooth} (${t.role})`
                          : t.tooth,
                      )
                      .join(', ')}
                  </p>
                )}
                {i.details && (
                  <p className="text-xs text-text-2">
                    {Object.entries(i.details)
                      .filter(([, v]) => v !== null)
                      .map(
                        ([k, v]) =>
                          `${k.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${v}`,
                      )
                      .join(' · ')}
                  </p>
                )}
              </div>
            ))}
            {order.notes && (
              <p className="text-sm text-text-2">Instructions: {order.notes}</p>
            )}
          </div>
        </Section>

        {!isDraft && <LabAccessPanel order={order} />}
        {!isDraft && <ProductionPanel order={order} />}
        {!isDraft && (
          <LabBillingPanel orderId={order.id} patient={order.patient} />
        )}
        {!isDraft && <Conversation order={order} />}
        {order.charges.length > 0 && <Charges order={order} />}
        {order.revisions.length > 0 && (
          <Section title="Revisions">
            <ul className="space-y-2 text-sm">
              {order.revisions.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    Rev {r.revisionNo} · {r.reason ?? 'Submitted'} ·{' '}
                    {r.createdBy?.name ?? '—'} · {fmt(r.createdAt)}
                  </span>
                  {r.labAcknowledgedAt ? (
                    <Badge variant="success">
                      Lab read {fmt(r.labAcknowledgedAt)}
                    </Badge>
                  ) : (
                    <Badge variant="muted">Not read by lab yet</Badge>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Files order={order} />
        <Section title="History">
          <ul className="space-y-1 text-sm">
            {order.history
              .filter((h) => h.kind === 'status')
              .map((h) => (
                <li key={h.id} className="text-text-2">
                  {fmt(h.createdAt)} — {statusLabel(h.fromState)} →{' '}
                  {statusLabel(h.toState)}
                  {h.actor?.name ? ` by ${h.actor.name}` : ''} ({h.actorSide}
                  {h.via && h.via !== 'app'
                    ? `, ${VIA_LABEL[h.via] ?? h.via}`
                    : ''}
                  ){h.reason ? ` — ${h.reason}` : ''}
                </li>
              ))}
          </ul>
        </Section>
      </div>

      <LabOrderSheet open={editing} onOpenChange={setEditing} order={order} />
      {!isDraft && (
        <RevisionSheet
          open={revising}
          onOpenChange={setRevising}
          order={order}
        />
      )}
      <ReasonDialog
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
        title={chosen?.label ?? ''}
        description="The reason is kept in the order's history."
        confirmLabel={chosen?.label ?? ''}
        destructive={chosen?.destructive ?? false}
        isLoading={transition.isPending}
        onConfirm={(reason) =>
          transition.mutate(
            { action: action!, reason },
            { onSuccess: () => setAction(null) },
          )
        }
      />
    </DashboardLayout>
  )
}

function Conversation({ order }: { order: LabOrderDetail }) {
  const [body, setBody] = useState('')
  const asking = order.status === 'clarification_needed'
  const send = useOrderMutation(
    () =>
      labOrdersApi.message(order.id, {
        kind: asking ? 'reply' : 'note',
        body: body.trim(),
      }),
    { success: asking ? 'Reply sent — the lab can continue' : 'Message sent' },
  )
  return (
    <Section title="Messages">
      <ul className="space-y-2">
        {order.messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-lg p-3 text-sm ${m.authorSide === 'lab' ? 'bg-muted/50' : 'border border-border'}`}
          >
            <p className="text-xs text-text-3">
              {m.authorSide === 'lab' ? 'Lab' : 'Clinic'} ·{' '}
              {m.author?.name ?? '—'} · {fmt(m.createdAt)}
              {m.kind === 'clarification_request' &&
                (m.resolvedAt ? ' · answered' : ' · needs your reply')}
            </p>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
        {!order.messages.length && (
          <li className="text-sm text-text-3">No messages yet.</li>
        )}
      </ul>
      <div className="flex items-end gap-2">
        <Textarea
          aria-label={asking ? 'Reply to the lab' : 'Message the lab'}
          rows={2}
          value={body}
          placeholder={
            asking ? 'Answer the lab’s question…' : 'Write to the lab…'
          }
          onChange={(e) => setBody(e.target.value)}
        />
        <Button
          disabled={!body.trim() || send.isPending}
          onClick={() =>
            send.mutate(undefined, { onSuccess: () => setBody('') })
          }
        >
          {send.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {asking ? 'Reply' : 'Send'}
        </Button>
      </div>
    </Section>
  )
}

function Charges({ order }: { order: LabOrderDetail }) {
  const decide = useOrderMutation(
    (v: { id: string; version: number; decision: 'approve' | 'reject' }) =>
      labOrdersApi.decideCharge(order.id, v.id, {
        decision: v.decision,
        version: v.version,
      }),
    { success: 'Charge decided' },
  )
  return (
    <Section title="Extra charges">
      <ul className="space-y-2 text-sm">
        {order.charges.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <span>
              {statusLabel(c.kind)} · {formatPaisa(c.amountPaisa)} — {c.reason}
            </span>
            {c.status === 'pending' ? (
              <span className="flex gap-1">
                <TooltipButton
                  tooltip="Approve charge"
                  size="icon"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({
                      id: c.id,
                      version: c.version,
                      decision: 'approve',
                    })
                  }
                >
                  <Check className="size-4" />
                </TooltipButton>
                <TooltipButton
                  tooltip="Reject charge"
                  size="icon"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({
                      id: c.id,
                      version: c.version,
                      decision: 'reject',
                    })
                  }
                >
                  <X className="size-4" />
                </TooltipButton>
              </span>
            ) : (
              <Badge variant={c.status === 'approved' ? 'success' : 'danger'}>
                {statusLabel(c.status)}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}

const VISIBILITY = [
  { value: 'lab_shared', label: 'Shared with the lab' },
  { value: 'internal', label: 'Clinic only' },
]

function Files({ order }: { order: LabOrderDetail }) {
  const [visibility, setVisibility] = useState('lab_shared')
  const upload = useOrderMutation(
    (file: File) => labOrdersApi.upload(order.id, file, { visibility }),
    { success: 'File attached' },
  )
  const download = async (a: OrderAttachment) => {
    try {
      const { url } = await labOrdersApi.attachmentUrl(order.id, a.id)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      toastOrderError(err)
    }
  }
  return (
    <Section title="Files">
      <ul className="space-y-2 text-sm">
        {order.attachments.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">
              {a.fileName}{' '}
              <span className="text-xs text-text-3">
                ·{' '}
                {a.visibility === 'internal'
                  ? 'clinic only'
                  : 'shared with lab'}{' '}
                · {a.uploadedSide}
              </span>
            </span>
            <TooltipButton
              tooltip={`Download ${a.fileName}`}
              size="icon"
              variant="ghost"
              onClick={() => void download(a)}
            >
              <Download className="size-4" />
            </TooltipButton>
          </li>
        ))}
        {!order.attachments.length && (
          <li className="text-text-3">No files yet.</li>
        )}
      </ul>
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <FileUploadField
          accept="*/*"
          maxSizeMb={50}
          disabled={upload.isPending}
          onFileSelected={(f) => f && upload.mutate(f)}
        />
        <FormSelect
          label="Who can see it"
          value={visibility}
          onValueChange={setVisibility}
          options={VISIBILITY}
        />
      </div>
    </Section>
  )
}
