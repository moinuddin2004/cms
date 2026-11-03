import type { ReactNode } from 'react'
import { formatInClinic } from '@/lib/datetime'
import { Check, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { formatMinor } from '@/features/lab-catalog'
import { ItemStatusBadge } from '@/features/lab-orders'
import type {
  PortalFormField,
  PortalOrderDetail,
  PortalOrderItem,
} from '../types'

export const fmtDateTime = (iso: string) => formatInClinic(iso, 'd MMM, HH:mm')

export function OrderSection({
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

/** Form answers as label → value (teeth and files are shown elsewhere). */
export function answerRows(
  item: Pick<PortalOrderItem, 'form' | 'answers'>,
): { label: string; value: string }[] {
  const fields: PortalFormField[] = item.form?.schemaJson?.fields ?? []
  const rows: { label: string; value: string }[] = []
  for (const f of fields) {
    const v = item.answers[f.key]
    if (v === undefined || v === null || v === '') continue
    if (f.type === 'tooth_chart' || f.type === 'file') continue
    const label = f.label ?? f.key.replace(/_/g, ' ')
    const pick = (x: unknown) =>
      f.options?.find((o) => o.value === x)?.label ?? String(x)
    const value = Array.isArray(v)
      ? v.map(pick).join(', ')
      : typeof v === 'boolean'
        ? v
          ? 'Yes'
          : 'No'
        : pick(v)
    rows.push({ label, value })
  }
  return rows
}

/**
 * An order as the lab may see it (lab ERD §13): the work, teeth, form
 * answers, lab cost, revisions, messages and shared files — never the
 * patient's price or records. Read-only; callers add the actions.
 */
export function LabOrderView({
  order,
  onDownload,
  onAcknowledge,
  acknowledging,
  messageBox,
  filesAction,
}: {
  order: PortalOrderDetail
  onDownload: (attachmentId: string) => void
  onAcknowledge?: (revisionNo: number) => void
  acknowledging?: boolean
  messageBox?: ReactNode
  /** e.g. the portal's upload button (absent on the magic-link page). */
  filesAction?: ReactNode
}) {
  return (
    <div className="space-y-6">
      <OrderSection
        title="Work"
        action={
          <span className="text-sm tabular-nums text-text-2">
            Lab total {formatMinor(order.labCostMinor)}
          </span>
        }
      >
        <div className="space-y-3">
          {order.items.map((i) => {
            const answers = answerRows(i)
            return (
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
                    <span className="text-sm tabular-nums">
                      {formatMinor(i.labLineCostMinor)}
                    </span>
                    <ItemStatusBadge status={i.status} />
                  </div>
                </div>
                {i.teeth.length > 0 && (
                  <p className="mt-2 text-sm">
                    <span className="text-text-3">Teeth: </span>
                    {i.teeth
                      .map((t) =>
                        t.role && t.role !== 'crown'
                          ? `${t.tooth} (${t.role})`
                          : t.tooth,
                      )
                      .join(', ')}
                  </p>
                )}
                {answers.length > 0 && (
                  <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                    {answers.map((a) => (
                      <div key={a.label} className="flex gap-2">
                        <dt className="text-text-3">{a.label}:</dt>
                        <dd>{a.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )
          })}
          {order.notes && (
            <p className="text-sm text-text-2">Instructions: {order.notes}</p>
          )}
        </div>
      </OrderSection>

      {order.revisions.length > 0 && (
        <OrderSection title="Revisions">
          <ul className="space-y-2 text-sm">
            {order.revisions.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  Rev {r.revisionNo} · {r.reason ?? 'Submitted'} ·{' '}
                  {fmtDateTime(r.createdAt)}
                </span>
                {r.labAcknowledgedAt ? (
                  <Badge variant="success">
                    Read {fmtDateTime(r.labAcknowledgedAt)}
                  </Badge>
                ) : onAcknowledge ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acknowledging}
                    onClick={() => onAcknowledge(r.revisionNo)}
                  >
                    <Check className="size-4" /> Mark as read
                  </Button>
                ) : (
                  <Badge variant="muted">New</Badge>
                )}
              </li>
            ))}
          </ul>
        </OrderSection>
      )}

      <OrderSection title="Messages">
        <ul className="space-y-2">
          {order.messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-lg p-3 text-sm ${m.authorSide === 'lab' ? 'border border-border' : 'bg-muted/50'}`}
            >
              <p className="text-xs text-text-3">
                {m.authorSide === 'lab' ? 'Lab' : 'Clinic'}
                {m.author?.name ? ` · ${m.author.name}` : ''} ·{' '}
                {fmtDateTime(m.createdAt)}
                {m.kind === 'clarification_request' &&
                  (m.resolvedAt ? ' · answered' : ' · waiting for the clinic')}
              </p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
          {!order.messages.length && (
            <li className="text-sm text-text-3">No messages yet.</li>
          )}
        </ul>
        {messageBox}
      </OrderSection>

      <OrderSection title="Files" action={filesAction}>
        <ul className="space-y-2 text-sm">
          {order.attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">
                {a.fileName}{' '}
                <span className="text-xs text-text-3">
                  · from {a.uploadedSide}
                </span>
              </span>
              <TooltipButton
                tooltip={`Download ${a.fileName}`}
                size="icon"
                variant="ghost"
                onClick={() => onDownload(a.id)}
              >
                <Download className="size-4" />
              </TooltipButton>
            </li>
          ))}
          {!order.attachments.length && (
            <li className="text-text-3">No files shared with the lab.</li>
          )}
        </ul>
      </OrderSection>
    </div>
  )
}
