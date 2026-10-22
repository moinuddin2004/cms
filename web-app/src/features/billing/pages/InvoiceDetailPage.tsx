import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Ban,
  History,
  ListOrdered,
  Pencil,
  Receipt,
  ReceiptText,
  Undo2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DataTable } from '@/components/shared/DataTable'
import {
  ErrorState,
  InitialsAvatar,
  LoadingSkeleton,
} from '@/components/shared'
import { useAccess } from '@/features/access'
import { formatDate } from '@/lib/formatters'
import { useBillingMutation } from '../hooks/use-billing-mutation'
import { useInvoiceDetail } from '../hooks/use-billing-queries'
import { invoicesApi } from '../services/billing-v2.api'
import type { Charge, Invoice } from '../types/billing.types'
import { CollectPaymentSheet } from '../components/collect-payment/CollectPaymentSheet'
import { EditInvoiceSheet } from '../components/invoices/EditInvoiceSheet'
import type { InvoiceEditRequest } from '../components/invoices/EditInvoiceSheet'
import { PrintButton } from '../components/print/PrintButton'
import { RefundSheet } from '../components/refunds/RefundSheet'
import type { RefundTarget } from '../components/refunds/RefundSheet'
import { ReasonDialog } from '../components/shared/ReasonDialog'
import {
  ChargeBadges,
  Money,
  PaymentStatusBadge,
} from '../components/shared/billing-badges'
import {
  SectionCard,
  SectionHeading,
  Stat,
} from '../components/shared/billing-ui'

/** Invoice detail (plan §8.3): charges, payments, refunds, revisions, actions. */
export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const invoice = useInvoiceDetail(invoiceId)
  const inv = invoice.data
  return (
    <DashboardLayout
      title={inv ? `Invoice ${inv.invoiceNumber}` : 'Invoice'}
      backTo="/invoices"
      backLabel="Back to invoices"
      actions={
        inv && (
          <InvoiceActions
            invoice={inv}
            onReload={() => void invoice.refetch()}
          />
        )
      }
    >
      {invoice.isLoading ? (
        <LoadingSkeleton variant="detail" />
      ) : invoice.isError || !inv ? (
        <ErrorState onRetry={() => void invoice.refetch()} />
      ) : (
        <InvoiceBody invoice={inv} />
      )}
    </DashboardLayout>
  )
}

function InvoiceActions({
  invoice,
  onReload,
}: {
  invoice: Invoice
  onReload: () => void
}) {
  const [open, setOpen] = useState<
    'collect' | 'edit' | 'cancel' | 'refund' | null
  >(null)
  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null)
  const cancel = useBillingMutation(
    (reason: string) => invoicesApi.cancel(invoice.id, reason),
    {
      success: 'Invoice cancelled',
    },
  )
  const { can } = useAccess()
  const issued = invoice.status === 'ISSUED'
  const close = (o: boolean) => !o && setOpen(null)

  const openRefund = (edit?: InvoiceEditRequest, released = 0) => {
    setRefundTarget({
      kind: 'invoice',
      patient: invoice.patient,
      invoiceId: invoice.id,
      max: invoice.refundableAmount + released,
      edit,
    })
    setOpen('refund')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PrintButton documentType="invoice" id={invoice.id} />
      {issued && can('billing.invoice.edit') && (
        <Button size="sm" variant="outline" onClick={() => setOpen('edit')}>
          <Pencil className="size-3.5" /> Edit
        </Button>
      )}
      {invoice.refundableAmount > 0 && can('billing.refund.issue') && (
        <Button size="sm" variant="outline" onClick={() => openRefund()}>
          <Undo2 className="size-3.5" /> Refund
        </Button>
      )}
      {issued && invoice.paidAmount === 0 && can('billing.invoice.void') && (
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setOpen('cancel')}
        >
          <Ban className="size-3.5" /> Cancel
        </Button>
      )}
      {issued && invoice.balanceDue > 0 && can('billing.payment.collect') && (
        <Button size="sm" onClick={() => setOpen('collect')}>
          <Receipt className="size-3.5" /> Collect payment
        </Button>
      )}

      <CollectPaymentSheet
        patient={invoice.patient}
        open={open === 'collect'}
        onOpenChange={close}
        preselectChargeIds={(invoice.charges ?? []).map((c) => c.id)}
      />
      {issued && (
        <EditInvoiceSheet
          invoice={invoice}
          open={open === 'edit'}
          onOpenChange={close}
          onReload={onReload}
          onSaveAndRefund={(edit, released) => openRefund(edit, released)}
        />
      )}
      <RefundSheet
        target={refundTarget}
        open={open === 'refund'}
        onOpenChange={close}
      />
      <ReasonDialog
        open={open === 'cancel'}
        onOpenChange={close}
        title={`Cancel ${invoice.invoiceNumber}?`}
        description={`${invoice.patient.name}'s charges go back to "not invoiced". The number stays used.`}
        confirmLabel="Cancel invoice"
        onConfirm={(reason) => cancel.mutateAsync(reason)}
      />
    </div>
  )
}

function InvoiceBody({ invoice: inv }: { invoice: Invoice }) {
  const chargeColumns = useMemo<ColumnDef<Charge, unknown>[]>(
    () => [
      {
        accessorKey: 'description',
        header: 'Charge',
        cell: ({ row }) => (
          <div
            className={
              row.original.status === 'VOID' ? 'opacity-60' : undefined
            }
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                dir="auto"
                className={
                  row.original.status === 'VOID'
                    ? 'text-sm line-through'
                    : 'text-sm font-medium'
                }
              >
                {row.original.description}
              </span>
              <ChargeBadges charge={row.original} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {formatDate(row.original.chargeDate)}
              {row.original.doctorName && ` · ${row.original.doctorName}`}
            </p>
          </div>
        ),
      },
      { accessorKey: 'quantity', header: 'Qty' },
      {
        accessorKey: 'unitPrice',
        header: 'Price',
        cell: ({ row }) => <Money value={row.original.unitPrice} />,
      },
      {
        id: 'discount',
        header: 'Discount',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.discount ? (
            <span className="text-xs">
              {row.original.discount.name}{' '}
              <span className="text-muted-foreground">−</span>
              <Money value={row.original.discount.amount} />
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'netAmount',
        header: 'Net',
        cell: ({ row }) => (
          <Money value={row.original.netAmount} className="font-semibold" />
        ),
      },
      {
        accessorKey: 'allocatedAmount',
        header: 'Paid',
        cell: ({ row }) => (
          <Money
            value={row.original.allocatedAmount}
            className="text-muted-foreground"
          />
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      {inv.status === 'CANCELLED' && (
        <div
          className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger"
          role="alert"
        >
          Cancelled {inv.cancelledAt ? formatDate(inv.cancelledAt) : ''} —{' '}
          <span dir="auto">{inv.cancelReason}</span>
        </div>
      )}

      <Card className="py-0">
        <CardContent className="flex flex-wrap items-start justify-between gap-6 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <InitialsAvatar
              name={inv.patient.name}
              seed={inv.patient.id}
              size="md"
            />
            <div className="min-w-0">
              <p
                dir="auto"
                className="truncate text-base font-semibold leading-tight"
              >
                {inv.patient.name}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {[inv.patient.mrn, inv.patient.phone]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <PaymentStatusBadge
                  status={inv.status}
                  paymentStatus={inv.paymentStatus}
                  refundStatus={inv.refundStatus}
                  refundedAmount={inv.refundedAmount}
                />
                {inv.revision > 1 && (
                  <Badge variant="info">Rev {inv.revision}</Badge>
                )}
                <span>Issued {formatDate(inv.issueDate)}</span>
                <span>· Due {formatDate(inv.dueDate)}</span>
                {inv.issuedByName && <span>· by {inv.issuedByName}</span>}
              </div>
            </div>
          </div>
          <div className="w-full max-w-64 space-y-1.5 rounded-lg border border-border bg-panel p-3">
            <Stat label="Subtotal">
              <Money value={inv.subtotal} />
            </Stat>
            <Stat label="Discount">
              <Money value={inv.discountTotal} />
            </Stat>
            <Stat label="Total" strong>
              <Money value={inv.totalAmount} />
            </Stat>
            <Stat label="Paid">
              <Money value={inv.paidAmount} />
            </Stat>
            <div className="border-t border-border-soft pt-1.5">
              <Stat label="Balance due" strong>
                <Money
                  value={inv.balanceDue}
                  className={inv.balanceDue > 0 ? 'text-danger' : undefined}
                />
              </Stat>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <SectionHeading icon={ListOrdered} title="Charges" />
        <DataTable
          columns={chargeColumns}
          data={inv.charges ?? []}
          pagination={false}
          emptyMessage="No charges on this invoice."
        />
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SectionCard icon={ReceiptText} title="Payments on this invoice">
          {!inv.payments?.length ? (
            <p className="text-sm italic text-muted-foreground">
              No payments yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {inv.payments.map((p) => (
                <div
                  key={p.paymentId}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div>
                    <p className="font-mono text-[13px] font-semibold">
                      {p.receiptNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.paymentDate)} · {p.paymentAccountName}
                    </p>
                  </div>
                  <Money
                    value={p.amountOnThisInvoice}
                    className="font-semibold"
                  />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
        <SectionCard
          icon={Undo2}
          title="Refunds"
          description={
            inv.refundedAmount > 0 ? (
              <>
                Refunded <Money value={inv.refundedAmount} /> · still refundable{' '}
                <Money value={inv.refundableAmount} />
              </>
            ) : undefined
          }
        >
          {!inv.refunds?.length ? (
            <p className="text-sm italic text-muted-foreground">No refunds.</p>
          ) : (
            <div className="space-y-2.5">
              {inv.refunds.map((r) => (
                <div
                  key={r.refundId}
                  className="flex items-start justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-[13px] font-semibold">
                      {r.refundNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.refundDate)} · {r.paymentAccountName} ·{' '}
                      {r.refundedByName ?? '—'}
                    </p>
                    <p dir="auto" className="truncate text-xs">
                      {r.reason}
                    </p>
                  </div>
                  <Money value={r.amount} className="font-semibold" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {!!inv.revisions?.length && (
        <SectionCard icon={History} title="Revision history">
          <div className="space-y-2.5">
            {inv.revisions.map((r) => (
              <div
                key={r.revision}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="info">Rev {r.revision}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.editedAt).toLocaleString()} ·{' '}
                    {r.editedByName ?? '—'}
                  </span>
                  <span dir="auto" className="truncate">
                    {r.reason}
                  </span>
                </div>
                <PrintButton
                  documentType="invoice"
                  id={inv.id}
                  label={`Print rev ${r.revision - 1}`}
                  params={{ revision: r.revision - 1 }}
                />
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
