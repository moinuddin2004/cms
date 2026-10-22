import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { HandCoins, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { formatPaisa } from '@/features/lab-catalog'
import { useLabBillingMutation, useOrderBilling } from '../hooks/useLabBilling'
import { useLabBillingAccess } from '../hooks/useLabBillingAccess'
import { labBillingApi } from '../services/lab-billing.api'
import type { PatientRef } from '../types'
import { LabInvoiceStatusBadge, MoneyRow } from './billing-bits'
import { InvoiceSheet } from './InvoiceSheet'
import { CollectPaymentSheet } from './MoneySheets'

/**
 * Billing of one lab order (lab ERD §6a, §15): what the patient was billed,
 * paid and still owes; bill unbilled work; collect a payment. Front desk
 * only (admin + reception, like billing v2) — renders nothing for doctors.
 */
export function LabBillingPanel({
  orderId,
  patient,
}: {
  orderId: string
  patient: PatientRef
}) {
  const access = useLabBillingAccess()
  const billing = useOrderBilling(orderId, access.canBill)
  const [billingOpen, setBillingOpen] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const create = useLabBillingMutation(labBillingApi.createInvoice, 'Saved')
  const collect = useLabBillingMutation(
    ({
      body,
      key,
    }: {
      body: Parameters<typeof labBillingApi.collect>[0]
      key: string
    }) => labBillingApi.collect(body, key),
    'Payment received',
  )
  if (!access.canBill) return null

  const data = billing.data
  const open = data?.invoices.filter(
    (i) => i.status === 'issued' || i.status === 'partially_paid',
  )
  const target = open?.length === 1 ? open[0] : null
  const unbilled =
    (data?.unbilledItems.length ?? 0) + (data?.unbilledCharges.length ?? 0)

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Billing</h2>
        <div className="flex gap-2">
          {unbilled > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBillingOpen(true)}
            >
              <Receipt className="size-4" /> Bill {unbilled} item
              {unbilled === 1 ? '' : 's'}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setCollecting(true)}
            disabled={!data}
          >
            <HandCoins className="size-4" /> Collect payment
          </Button>
        </div>
      </div>

      {billing.isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : billing.isError || !data ? (
        <ErrorState onRetry={() => void billing.refetch()} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
          <div className="space-y-2">
            {data.invoices.length === 0 ? (
              <p className="text-sm text-text-3">
                Nothing billed yet. Bill the work to give the patient an
                estimate or an invoice.
              </p>
            ) : (
              data.invoices.map((i) => (
                <Link
                  key={i.id}
                  to="/lab-billing/$invoiceId"
                  params={{ invoiceId: i.id }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="min-w-0">
                    <span className="font-medium">
                      {i.invoiceNo ?? 'Estimate'}
                    </span>
                    <span className="ml-2 text-text-3">{i.issuedOn ?? ''}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums">
                      {formatPaisa(i.totalPaisa)}
                    </span>
                    <LabInvoiceStatusBadge
                      status={i.status}
                      overdue={i.overdue}
                    />
                  </span>
                </Link>
              ))
            )}
          </div>
          <div className="space-y-1 rounded-lg bg-muted/40 p-3">
            <MoneyRow label="Billed" value={data.totals.billedPaisa} />
            {data.totals.creditedPaisa > 0 && (
              <MoneyRow
                label="Credited"
                value={data.totals.creditedPaisa}
                negative
              />
            )}
            <MoneyRow label="Paid" value={data.totals.paidPaisa} />
            <MoneyRow label="Balance" value={data.totals.balancePaisa} strong />
            {data.patientSummary.advancePaisa > 0 && (
              <MoneyRow
                label="Patient advance"
                value={data.patientSummary.advancePaisa}
              />
            )}
          </div>
        </div>
      )}

      <InvoiceSheet
        open={billingOpen}
        onOpenChange={setBillingOpen}
        billing={data}
        onSave={(input) =>
          create.mutateAsync({ ...input, orderId }).then((inv) => {
            void billing.refetch()
            return inv
          })
        }
      />
      <CollectPaymentSheet
        open={collecting}
        onOpenChange={setCollecting}
        patient={patient}
        invoice={target}
        onCollect={(body, key) => collect.mutateAsync({ body, key })}
      />
    </section>
  )
}
