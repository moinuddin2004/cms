import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Bell,
  FileMinus,
  HandCoins,
  Loader2,
  Pencil,
  Send,
  Wallet,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, LoadingSkeleton, StatusBadge } from '@/components/shared'
import { formatMinor } from '@/features/lab-catalog'
import { formatInClinic } from '@/lib/datetime'
import {
  LabInvoiceStatusBadge,
  MoneyRow,
  MoneyAmount,
  ReasonDialog,
} from '../components/billing-bits'
import { InvoiceSheet } from '../components/InvoiceSheet'
import { useLabBillingAccess } from '../hooks/useLabBillingAccess'
import {
  CollectPaymentSheet,
  CreditNoteSheet,
  RefundSheet,
} from '../components/MoneySheets'
import {
  useLabBillingMutation,
  useLabInvoice,
  useOrderBilling,
} from '../hooks/useLabBilling'
import { labBillingApi, newIdempotencyKey } from '../services/lab-billing.api'
import { METHOD_LABEL } from '../types'
import type { LabCreditNote, LabInvoiceDetail } from '../types'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
    </section>
  )
}

const fmtTime = (iso: string) => formatInClinic(iso, 'd MMM, HH:mm')

/** One lab invoice or estimate (lab ERD §6a). */
export function LabInvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const access = useLabBillingAccess()
  const q = useLabInvoice(invoiceId)
  const inv = q.data
  const orderBilling = useOrderBilling(
    inv?.order?.id ?? '',
    !!inv?.order && inv.status === 'draft',
  )
  const [editing, setEditing] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [crediting, setCrediting] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [refundFor, setRefundFor] = useState<LabCreditNote | 'advance' | null>(
    null,
  )

  const update = useLabBillingMutation(
    (
      input: Parameters<typeof labBillingApi.updateInvoice>[1] & {
        issue?: boolean
      },
    ) =>
      labBillingApi
        .updateInvoice(invoiceId, input)
        .then((d) =>
          input.issue ? labBillingApi.issue(invoiceId, d.version) : d,
        ),
    'Estimate saved',
  )
  const issue = useLabBillingMutation(
    (version: number) => labBillingApi.issue(invoiceId, version),
    'Invoice issued',
  )
  const voidIt = useLabBillingMutation(
    ({ version, reason }: { version: number; reason: string }) =>
      labBillingApi.void(invoiceId, version, reason),
    'Invoice voided',
  )
  const applyAdvance = useLabBillingMutation(
    () => labBillingApi.applyAdvance(invoiceId, newIdempotencyKey()),
    'Advance applied',
  )
  const remind = useLabBillingMutation(() => labBillingApi.remind(invoiceId))
  const collect = useLabBillingMutation(
    ({
      body,
      key,
    }: {
      body: Parameters<typeof labBillingApi.collect>[0]
      key: string
    }) => labBillingApi.collect(body, key),
  )
  const credit = useLabBillingMutation(
    ({
      body,
      key,
    }: {
      body: { amountMinor: number; reason: string }
      key: string
    }) => labBillingApi.creditNote(invoiceId, body, key),
    'Credit note issued',
  )
  const refund = useLabBillingMutation(
    ({
      body,
      key,
    }: {
      body: Parameters<typeof labBillingApi.refund>[0]
      key: string
    }) => labBillingApi.refund(body, key),
    'Refund recorded',
  )

  if (q.isLoading || access.isLoading)
    return (
      <DashboardLayout
        title="Invoice"
        backTo="/lab-billing"
        backLabel="Back to lab billing"
      >
        <LoadingSkeleton variant="table" />
      </DashboardLayout>
    )
  if (q.isError || !inv)
    return (
      <DashboardLayout
        title="Invoice"
        backTo="/lab-billing"
        backLabel="Back to lab billing"
      >
        <ErrorState onRetry={() => void q.refetch()} />
      </DashboardLayout>
    )

  const open = inv.status === 'issued' || inv.status === 'partially_paid'
  const advance = inv.patientSummary.advanceMinor
  const canVoid =
    access.canVoid &&
    inv.status !== 'void' &&
    inv.paidMinor === 0 &&
    inv.creditedMinor === 0
  const canCredit =
    access.canVoid &&
    ['issued', 'partially_paid', 'paid'].includes(inv.status) &&
    inv.totalMinor > inv.creditedMinor

  const actions = (
    <div className="flex flex-wrap gap-2">
      {inv.status === 'draft' && (
        <>
          <Button
            variant="outline"
            onClick={() => setEditing(true)}
            disabled={!inv.order}
          >
            <Pencil className="size-4" /> Edit
          </Button>
          <Button
            onClick={() => issue.mutate(inv.version)}
            disabled={issue.isPending}
          >
            {issue.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Issue invoice
          </Button>
        </>
      )}
      {open && advance > 0 && (
        <Button
          variant="outline"
          onClick={() => applyAdvance.mutate(undefined)}
          disabled={applyAdvance.isPending}
        >
          {applyAdvance.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wallet className="size-4" />
          )}
          Use advance ({formatMinor(advance)})
        </Button>
      )}
      {open && (
        <Button
          variant="outline"
          disabled={remind.isPending}
          onClick={() =>
            remind.mutate(undefined, {
              onSuccess: (rows) =>
                toast.success(
                  rows.some(
                    (r) =>
                      r.status === 'queued' || r.status === 'held_quiet_hours',
                  )
                    ? 'Reminder queued'
                    : 'Reminder logged — patient messages are off for this event',
                ),
            })
          }
        >
          {remind.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Bell className="size-4" />
          )}
          Send reminder
        </Button>
      )}
      {canCredit && (
        <Button variant="outline" onClick={() => setCrediting(true)}>
          <FileMinus className="size-4" /> Credit note
        </Button>
      )}
      {canVoid && (
        <Button variant="outline" onClick={() => setVoiding(true)}>
          <XCircle className="size-4" /> Void
        </Button>
      )}
      {open && (
        <Button onClick={() => setCollecting(true)}>
          <HandCoins className="size-4" /> Collect payment
        </Button>
      )}
    </div>
  )

  return (
    <DashboardLayout
      title={inv.invoiceNo ? `Invoice ${inv.invoiceNo}` : 'Estimate'}
      subtitle={`${inv.patient.fullName} · ${inv.patient.patientNumber}`}
      backTo="/lab-billing"
      backLabel="Back to lab billing"
      actions={access.canBill ? actions : undefined}
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <Section title="Lines">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-text-3">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 text-right font-medium">Qty</th>
                    <th className="py-2 pr-3 text-right font-medium">Price</th>
                    <th className="py-2 pr-3 text-right font-medium">
                      Discount
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">Tax</th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inv.lines.map((l) => (
                    <tr
                      key={l.id}
                      className="transition-colors hover:bg-muted/40"
                    >
                      <td className="py-2 pr-3">
                        {l.description}
                        {l.doctor && (
                          <span className="block text-xs text-text-3">
                            {l.doctor.fullName}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {l.quantity}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <MoneyAmount value={l.unitPriceMinor} />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <MoneyAmount value={l.discountMinor} />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <MoneyAmount value={l.taxMinor} />
                        {l.taxRateBp > 0 && (
                          <span className="block text-xs text-text-3">
                            {l.taxRateBp / 100}%
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <MoneyAmount value={l.lineTotalMinor} strong />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {inv.notes && <p className="text-sm text-text-3">{inv.notes}</p>}
          </Section>

          <Section title="Summary">
            <div className="flex items-center justify-between">
              <LabInvoiceStatusBadge
                status={inv.status}
                overdue={inv.overdue}
              />
              {inv.order && (
                <Link
                  to="/lab-orders/$orderId"
                  params={{ orderId: inv.order.id }}
                  className="text-sm text-primary hover:underline"
                >
                  Order {inv.order.orderNo}
                </Link>
              )}
            </div>
            {inv.issuedOn && (
              <p className="text-sm text-text-3">
                Issued {inv.issuedOn} · due {inv.dueOn}
              </p>
            )}
            {inv.status === 'void' && (
              <p className="text-sm text-text-3">Voided: {inv.voidReason}</p>
            )}
            <div className="space-y-1 border-t border-border pt-3">
              <MoneyRow label="Subtotal" value={inv.subtotalMinor} />
              <MoneyRow label="Discount" value={inv.discountMinor} negative />
              <MoneyRow label="Tax" value={inv.taxMinor} />
              <MoneyRow label="Total" value={inv.totalMinor} strong />
              {inv.creditedMinor > 0 && (
                <MoneyRow label="Credited" value={inv.creditedMinor} negative />
              )}
              <MoneyRow label="Paid" value={inv.paidMinor} negative />
              <MoneyRow
                label={inv.status === 'draft' ? 'Estimate' : 'Balance'}
                value={
                  inv.status === 'draft' ? inv.totalMinor : inv.balanceMinor
                }
                strong
              />
            </div>
            <div className="space-y-1 border-t border-border pt-3">
              <p className="text-xs font-medium text-text-3">
                Patient (all lab work)
              </p>
              <MoneyRow
                label="Owes"
                value={inv.patientSummary.receivableMinor}
              />
              <MoneyRow label="Advance" value={advance} />
              {access.canRefund && advance > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => setRefundFor('advance')}
                >
                  Refund advance
                </Button>
              )}
            </div>
          </Section>
        </div>

        <Section title="Payments">
          {inv.allocations.length === 0 ? (
            <p className="text-sm text-text-3">
              No payments on this invoice yet.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {inv.allocations.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span
                    className={a.reversedAt ? 'text-text-3 line-through' : ''}
                  >
                    {a.receiptNo} · {METHOD_LABEL[a.method]} ·{' '}
                    {fmtTime(a.createdAt)}
                  </span>
                  <span className="flex items-center gap-2">
                    {a.reversedAt && (
                      <StatusBadge
                        status="released"
                        tone="muted"
                        label={
                          a.releaseReason === 'credit_note'
                            ? 'Moved to advance'
                            : 'Reversed'
                        }
                      />
                    )}
                    <MoneyAmount value={a.amountMinor} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {inv.creditNotes.length > 0 && (
          <Section title="Credit notes">
            <ul className="divide-y divide-border text-sm">
              {inv.creditNotes.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2"
                >
                  <span>
                    <span className="font-medium">{c.creditNoteNo}</span> —{' '}
                    {c.reason}
                    {c.releasedMinor > 0 && (
                      <span className="block text-xs text-text-3">
                        {formatMinor(c.releasedMinor)} back to advance ·{' '}
                        {formatMinor(c.refundedMinor)} refunded
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge
                      status={c.status}
                      tone={c.status === 'issued' ? 'warning' : 'success'}
                    />
                    <MoneyAmount value={c.amountMinor} />
                    {access.canRefund &&
                      c.status === 'issued' &&
                      advance > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRefundFor(c)}
                        >
                          Refund
                        </Button>
                      )}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="History">
          <ul className="space-y-2 text-sm">
            {inv.history.map((h) => (
              <li key={h.id} className="flex justify-between gap-3">
                <span>
                  {h.kind === 'status'
                    ? `${h.fromState ?? '—'} → ${h.toState}`
                    : h.action}
                  {h.reason ? ` — ${h.reason}` : ''}
                  <span className="text-text-3">
                    {' '}
                    · {h.actor?.name ?? 'System'}
                  </span>
                </span>
                <span className="shrink-0 text-text-3">
                  {fmtTime(h.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <InvoiceSheet
        open={editing}
        onOpenChange={setEditing}
        billing={orderBilling.data}
        draft={inv}
        onSave={(input) =>
          update.mutateAsync({ ...input, version: inv.version })
        }
      />
      <CollectPaymentSheet
        open={collecting}
        onOpenChange={setCollecting}
        patient={inv.patient}
        invoice={inv}
        onCollect={(body, key) =>
          collect.mutateAsync({ body, key }).then((p) => {
            toast.success(`Payment received — receipt ${p.receiptNo}`)
            return p
          })
        }
      />
      <CreditNoteSheet
        open={crediting}
        onOpenChange={setCrediting}
        invoice={inv}
        onIssue={(body, key) => credit.mutateAsync({ body, key })}
      />
      <RefundSheet
        open={!!refundFor}
        onOpenChange={(o) => !o && setRefundFor(null)}
        patient={inv.patient}
        maxMinor={refundMax(inv, refundFor)}
        creditNote={refundFor && refundFor !== 'advance' ? refundFor : null}
        onRefund={(body, key) => refund.mutateAsync({ body, key })}
      />
      <ReasonDialog
        open={voiding}
        onOpenChange={setVoiding}
        title={`Void ${inv.invoiceNo ?? 'this estimate'}?`}
        description="The invoice stays on record as void and its lab work can be billed again."
        confirmLabel="Void invoice"
        isLoading={voidIt.isPending}
        onConfirm={(reason) =>
          voidIt.mutate(
            { version: inv.version, reason },
            { onSuccess: () => setVoiding(false) },
          )
        }
      />
    </DashboardLayout>
  )
}

function refundMax(
  inv: LabInvoiceDetail,
  target: LabCreditNote | 'advance' | null,
): number {
  const advance = inv.patientSummary.advanceMinor
  if (!target) return 0
  if (target === 'advance') return advance
  return Math.min(advance, target.releasedMinor - target.refundedMinor)
}
