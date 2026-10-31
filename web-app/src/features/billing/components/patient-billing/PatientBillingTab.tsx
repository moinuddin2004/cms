import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import { formatDate } from '@/lib/formatters'
import { useAccess } from '@/features/access'
import {
  usePatientBillingSummary,
  usePatientInvoices,
  usePatientPayments,
} from '../../hooks/use-billing-queries'
import type { PatientRef, Payment } from '../../types/billing.types'
import { CollectPaymentSheet } from '../collect-payment/CollectPaymentSheet'
import { InvoiceTable } from '../invoices/InvoiceTable'
import { PrintButton } from '../print/PrintButton'
import { RefundSheet } from '../refunds/RefundSheet'
import { BillingSummaryCards } from '../shared/BillingSummaryCards'
import { Money } from '../shared/billing-badges'
import { OpenChargesPanel } from './OpenChargesPanel'
import { StatementPanel } from './StatementPanel'

const TRIGGER = 'h-8 px-3 text-xs data-[state=active]:shadow-sm'

/**
 * Billing tab on the patient page (plan §8.3). Renders nothing without
 * `billing.invoice.view` (D17). Same layout rhythm as the Overview tab.
 */
export function PatientBillingTab({
  patient,
}: {
  patient: Pick<PatientRef, 'id' | 'name'> & Partial<PatientRef>
}) {
  const { can } = useAccess()
  const summary = usePatientBillingSummary(patient.id)
  const [collectOpen, setCollectOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  if (!can('billing.invoice.view')) return null
  const advance = summary.data?.advance ?? 0

  return (
    <div className="mt-4 space-y-4 animate-in fade-in duration-300">
      <BillingSummaryCards
        summary={summary.data}
        isLoading={summary.isLoading}
      />

      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <Tabs defaultValue="open" className="gap-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-panel px-4 py-2.5">
            <TabsList className="h-auto gap-1 bg-muted/60 p-1">
              <TabsTrigger value="open" className={TRIGGER}>
                Open charges
              </TabsTrigger>
              <TabsTrigger value="invoices" className={TRIGGER}>
                Invoices
              </TabsTrigger>
              <TabsTrigger value="payments" className={TRIGGER}>
                Payments
              </TabsTrigger>
              <TabsTrigger value="statement" className={TRIGGER}>
                Statement
              </TabsTrigger>
            </TabsList>
            {advance > 0 && can('billing.refund.issue') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRefundOpen(true)}
              >
                <Undo2 className="size-3.5" /> Refund advance
              </Button>
            )}
          </div>
          <TabsContent value="open" className="p-4">
            <OpenChargesPanel
              patientId={patient.id}
              onCollect={() => setCollectOpen(true)}
            />
          </TabsContent>
          <TabsContent value="invoices" className="p-4">
            <PatientInvoices patientId={patient.id} />
          </TabsContent>
          <TabsContent value="payments" className="p-4">
            <PatientPayments patientId={patient.id} />
          </TabsContent>
          <TabsContent value="statement" className="p-4">
            <StatementPanel patientId={patient.id} />
          </TabsContent>
        </Tabs>
      </Card>

      <CollectPaymentSheet
        patient={patient}
        open={collectOpen}
        onOpenChange={setCollectOpen}
      />
      <RefundSheet
        target={{ kind: 'advance', patient, max: advance }}
        open={refundOpen}
        onOpenChange={setRefundOpen}
      />
    </div>
  )
}

function PatientInvoices({ patientId }: { patientId: string }) {
  const q = usePatientInvoices(patientId)
  if (q.isLoading) return <LoadingSkeleton variant="table" rows={3} />
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />
  if (!q.data?.data.length) {
    return (
      <EmptyState
        title="No invoices yet"
        description="Invoices are issued when a payment is taken or from open charges."
      />
    )
  }
  return <InvoiceTable invoices={q.data.data} showPatient={false} />
}

function PatientPayments({ patientId }: { patientId: string }) {
  const q = usePatientPayments(patientId)
  const columns = useMemo<ColumnDef<Payment, unknown>[]>(
    () => [
      {
        accessorKey: 'receiptNumber',
        header: 'Receipt',
        cell: ({ row }) => (
          <span className="font-mono text-[13px] font-semibold">
            {row.original.receiptNumber}
          </span>
        ),
      },
      {
        accessorKey: 'paymentDate',
        header: 'Date',
        cell: ({ row }) => formatDate(row.original.paymentDate),
      },
      { accessorKey: 'paymentAccountName', header: 'Account' },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <Money value={row.original.amount} className="font-semibold" />
        ),
      },
      {
        id: 'state',
        header: 'Left as advance',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5">
            <Money
              value={row.original.advance}
              className="text-muted-foreground"
            />
            {row.original.refundedAmount > 0 && (
              <Badge variant="violet" className="px-1.5 py-0 text-[10px]">
                Refunded <Money value={row.original.refundedAmount} />
              </Badge>
            )}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <PrintButton
              documentType="receipt"
              id={row.original.id}
              label="Receipt"
            />
          </div>
        ),
      },
    ],
    [],
  )
  if (q.isLoading) return <LoadingSkeleton variant="table" rows={3} />
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />
  if (!q.data?.data.length) return <EmptyState title="No payments yet" />
  return <DataTable columns={columns} data={q.data.data} />
}
