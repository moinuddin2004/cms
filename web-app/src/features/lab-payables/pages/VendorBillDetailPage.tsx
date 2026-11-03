import { useState } from 'react'
import { toClinicYmd } from '@/lib/datetime'
import { Link } from '@tanstack/react-router'
import {
  Ban,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingSkeleton, StatCard } from '@/components/shared'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { formatMinor, rupeesToMinor } from '@/features/lab-catalog'
import { ReasonDialog } from '@/features/lab-orders'
import { BillStatusBadge } from '../components/payables-badges'
import { AddBillLineSheet, EditBillSheet } from '../components/BillEditSheets'
import { ApproveBillSheet, PayLabSheet } from '../components/PayablesSheets'
import {
  usePayablesMutation,
  useVendorBill,
  useVendorBills,
} from '../hooks/useLabPayables'
import { percentToBp } from '../schemas/lab-payables.schema'
import type {
  ApproveBillValues,
  BillLineValues,
  EditBillValues,
  PayLabValues,
} from '../schemas/lab-payables.schema'
import { labPayablesApi, newPaymentKey } from '../services/lab-payables.api'
import { LINE_KIND_LABEL } from '../types'
import type { VendorBillDetail } from '../types'

/** One vendor bill: its lines (lab costs), what was paid, and the next step. */
export function VendorBillDetailPage({ billId }: { billId: string }) {
  const { data: bill, isLoading, isError, refetch } = useVendorBill(billId)
  const [approving, setApproving] = useState(false)
  const [paying, setPaying] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [addingLine, setAddingLine] = useState(false)
  const openBills = useVendorBills({
    labId: bill?.labId,
    open: 'true',
    page: 1,
    limit: 100,
  })

  const approve = usePayablesMutation(
    (v: { bill: VendorBillDetail; values: ApproveBillValues }) =>
      labPayablesApi.approve(v.bill.id, {
        version: v.bill.version,
        vendorInvoiceNo: v.values.vendorInvoiceNo || undefined,
        dueOn: v.values.dueOn || undefined,
        taxBp: percentToBp(v.values.taxPercent) ?? 0,
      }),
    'Bill approved — now owed to the lab',
  )
  const pay = usePayablesMutation(
    (v: { labId: string; values: PayLabValues; key: string }) =>
      labPayablesApi.pay(
        {
          labId: v.labId,
          amountMinor: rupeesToMinor(v.values.amount) ?? 0,
          method: v.values.method,
          reference: v.values.reference || undefined,
          paidOn: v.values.paidOn || undefined,
          allocations: v.values.allocations
            .map((a) => ({
              billId: a.billId,
              amountMinor: rupeesToMinor(a.amount) ?? 0,
            }))
            .filter((a) => a.amountMinor > 0),
        },
        v.key,
      ),
    'Payment recorded',
  )
  const voidBill = usePayablesMutation(
    (v: { bill: VendorBillDetail; reason: string }) =>
      labPayablesApi.voidBill(v.bill.id, {
        version: v.bill.version,
        reason: v.reason,
      }),
    'Bill voided',
  )
  const edit = usePayablesMutation(
    (v: { bill: VendorBillDetail; values: EditBillValues }) =>
      labPayablesApi.updateBill(v.bill.id, {
        version: v.bill.version,
        vendorInvoiceNo: v.values.vendorInvoiceNo || null,
        billDate: v.values.billDate,
        dueOn: v.values.dueOn || null,
        taxBp: percentToBp(v.values.taxPercent) ?? 0,
        notes: v.values.notes || null,
      }),
    'Bill updated',
  )
  const addLine = usePayablesMutation(
    (v: { bill: VendorBillDetail; values: BillLineValues }) =>
      labPayablesApi.addLine(v.bill.id, {
        version: v.bill.version,
        kind: v.values.kind,
        description: v.values.description.trim(),
        quantity: Number(v.values.quantity),
        unitCostMinor: rupeesToMinor(v.values.unitCost) ?? 0,
      }),
    'Line added',
  )
  const sync = usePayablesMutation(
    (orderId: string) => labPayablesApi.syncOrder(orderId),
    'Costs re-read from the order',
  )

  if (isLoading) {
    return (
      <DashboardLayout
        title="Vendor bill"
        backTo="/lab-payables"
        backLabel="Back to bills"
      >
        <LoadingSkeleton variant="detail" />
      </DashboardLayout>
    )
  }
  if (isError || !bill) {
    return (
      <DashboardLayout
        title="Vendor bill"
        backTo="/lab-payables"
        backLabel="Back to bills"
      >
        <ErrorState onRetry={() => void refetch()} />
      </DashboardLayout>
    )
  }

  const payable = bill.status === 'approved' || bill.status === 'partially_paid'
  const canVoid = bill.status !== 'void' && bill.paidMinor === 0
  const actions = (
    <div className="flex items-center gap-2">
      {bill.status === 'draft' && bill.labOrderId && (
        <TooltipButton
          tooltip="Re-read costs from the order"
          variant="outline"
          size="icon"
          disabled={sync.isPending}
          onClick={() => sync.mutate(bill.labOrderId as string)}
        >
          {sync.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
        </TooltipButton>
      )}
      {bill.status === 'draft' && (
        <TooltipButton
          tooltip="Edit bill details"
          variant="outline"
          size="icon"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-4" />
        </TooltipButton>
      )}
      {canVoid && (
        <Button variant="outline" onClick={() => setVoiding(true)}>
          <Ban className="size-4" /> Void
        </Button>
      )}
      {bill.status === 'draft' && (
        <Button
          onClick={() => setApproving(true)}
          disabled={bill.totalMinor <= 0}
        >
          <CheckCircle2 className="size-4" /> Approve
        </Button>
      )}
      {payable && (
        <Button onClick={() => setPaying(true)}>
          <Wallet className="size-4" /> Pay
        </Button>
      )}
    </div>
  )

  return (
    <DashboardLayout
      title={`Vendor bill ${bill.billNo}`}
      subtitle={`${bill.labName ?? ''}${bill.vendorInvoiceNo ? ` · lab invoice ${bill.vendorInvoiceNo}` : ''}`}
      backTo="/lab-payables"
      backLabel="Back to bills"
      actions={actions}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-sm text-text-3">
          <BillStatusBadge status={bill.status} />
          <span>Bill date {bill.billDate}</span>
          {bill.dueOn && <span>· Due {bill.dueOn}</span>}
          {bill.labOrderId && bill.orderNo && (
            <Link
              to="/lab-orders/$orderId"
              params={{ orderId: bill.labOrderId }}
              className="text-primary underline-offset-2 hover:underline"
            >
              · Order {bill.orderNo}
            </Link>
          )}
          {bill.voidReason && <span>· Voided: {bill.voidReason}</span>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total" value={formatMinor(bill.totalMinor)} />
          <StatCard label="Paid" value={formatMinor(bill.paidMinor)} />
          <StatCard
            label="Balance"
            value={
              bill.status === 'draft'
                ? 'Not approved'
                : formatMinor(bill.balanceMinor)
            }
          />
        </div>

        <section className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-lg font-medium">Lines</h2>
            {bill.status === 'draft' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddingLine(true)}
              >
                <Plus className="size-4" /> Add line
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-text-3">
                <tr>
                  <th className="px-4 py-2">Kind</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Unit</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.lines.map((l) => (
                  <tr
                    key={l.id}
                    className="border-t border-border/60 transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-2">{LINE_KIND_LABEL[l.lineKind]}</td>
                    <td className="px-4 py-2">
                      {l.description}
                      {l.isManual && (
                        <span className="ml-2 text-xs text-text-3">
                          (added by hand)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {l.quantity}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMinor(l.unitCostMinor)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatMinor(l.lineTotalMinor)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-right text-text-3">
                    Subtotal
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatMinor(bill.subtotalMinor)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-right text-text-3">
                    Tax ({bill.taxBp / 100}%)
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatMinor(bill.taxMinor)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-medium">Payments</h2>
          {bill.allocations.length === 0 ? (
            <p className="text-sm text-text-3">
              Nothing paid on this bill yet.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {bill.allocations.map((a) => (
                <li key={a.id} className="flex justify-between py-2">
                  <span>
                    {a.paymentNo} · {toClinicYmd(a.createdAt)}
                    {a.reversedAt && (
                      <span className="ml-2 text-xs text-red-500">
                        reversed
                      </span>
                    )}
                  </span>
                  <span
                    className={`tabular-nums ${a.reversedAt ? 'line-through text-text-3' : ''}`}
                  >
                    {formatMinor(a.amountMinor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <EditBillSheet
        bill={editing ? bill : null}
        onOpenChange={setEditing}
        onSubmit={(values) => edit.mutateAsync({ bill, values })}
      />
      <AddBillLineSheet
        open={addingLine}
        billNo={bill.billNo}
        onOpenChange={setAddingLine}
        onSubmit={(values) => addLine.mutateAsync({ bill, values })}
      />
      <ApproveBillSheet
        bill={approving ? bill : null}
        onOpenChange={setApproving}
        onSubmit={(values) => approve.mutateAsync({ bill, values })}
      />
      <PayLabSheet
        open={paying}
        labName={bill.labName ?? 'lab'}
        bills={(openBills.data?.data ?? []).filter(
          (b) => b.status === 'approved' || b.status === 'partially_paid',
        )}
        prefillBillId={bill.id}
        onOpenChange={setPaying}
        onSubmit={(values) =>
          pay.mutateAsync({ labId: bill.labId, values, key: newPaymentKey() })
        }
      />
      <ReasonDialog
        open={voiding}
        onOpenChange={setVoiding}
        title={`Void ${bill.billNo}?`}
        description={
          bill.status === 'draft'
            ? 'The draft is closed and nothing is owed for it.'
            : 'The approval is reversed in the ledger. The bill stays on record as void.'
        }
        confirmLabel="Void bill"
        destructive
        isLoading={voidBill.isPending}
        onConfirm={(reason) =>
          voidBill.mutate(
            { bill, reason },
            { onSuccess: () => setVoiding(false) },
          )
        }
      />
    </DashboardLayout>
  )
}
