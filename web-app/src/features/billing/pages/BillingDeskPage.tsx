import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@/components/shared/table-features'
import { AlertTriangle, Clock4, Receipt, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/DataTable'
import { DatePicker } from '@/components/shared/DatePicker'
import {
  ErrorState,
  InitialsAvatar,
  LoadingSkeleton,
  PageWrapper,
} from '@/components/shared'
import { formatDate } from '@/lib/formatters'
import { Can, useAccess } from '@/features/access'
import {
  useBillingSettings,
  useInvoiceList,
  useReadyToBill,
} from '../hooks/use-billing-queries'
import type {
  Invoice,
  PatientRef,
  ReadyToBillRow,
} from '../types/billing.types'
import { CollectPaymentSheet } from '../components/collect-payment/CollectPaymentSheet'
import { Money } from '../components/shared/billing-badges'
import { SectionHeading } from '../components/shared/billing-ui'

function PatientCell({
  id,
  name,
  sub,
}: {
  id: string
  name: string
  sub: string | null
}) {
  return (
    <div className="flex items-center gap-3">
      <InitialsAvatar name={name} seed={id} size="sm" />
      <div className="min-w-0">
        <p dir="auto" className="truncate text-sm font-semibold">
          {name}
        </p>
        {sub && (
          <p className="font-mono text-[11px] text-muted-foreground">{sub}</p>
        )}
      </div>
    </div>
  )
}

/**
 * Reception worklist (plan §8.1): "Ready to bill" (patients with unbilled
 * charges for a day) and "Outstanding" (overdue / unpaid invoices).
 */
export function BillingDeskPage() {
  const { can } = useAccess()
  const [date, setDate] = useState<string | undefined>()
  const [patient, setPatient] = useState<PatientRef | null>(null)
  const settings = useBillingSettings()
  const ready = useReadyToBill(date)
  const overdue = useInvoiceList({ paymentStatus: 'OVERDUE', limit: 50 })
  const unpaid = useInvoiceList({ paymentStatus: 'UNPAID', limit: 50 })
  const outstanding = [
    ...(overdue.data?.data ?? []),
    ...(unpaid.data?.data ?? []),
  ]

  const readyColumns = useMemo<ColumnDef<ReadyToBillRow, unknown>[]>(
    () => [
      {
        accessorKey: 'patientName',
        header: 'Patient',
        cell: ({ row }) => (
          <PatientCell
            id={row.original.patientId}
            name={row.original.patientName}
            sub={row.original.mrn ?? row.original.phone}
          />
        ),
      },
      {
        accessorKey: 'chargeCount',
        header: 'Charges',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            {row.original.chargeCount}
            {row.original.needsPricing && (
              <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                Needs price
              </Badge>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'unbilledTotal',
        header: 'Amount',
        cell: ({ row }) => (
          <Money value={row.original.unbilledTotal} className="font-semibold" />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-8"
              onClick={() =>
                setPatient({
                  id: row.original.patientId,
                  name: row.original.patientName,
                  phone: row.original.phone,
                  mrn: row.original.mrn,
                })
              }
            >
              <Receipt className="size-3.5" /> Bill
            </Button>
          </div>
        ),
      },
    ],
    [],
  )

  const dueColumns = useMemo<ColumnDef<Invoice, unknown>[]>(
    () => [
      {
        id: 'patient',
        header: 'Patient',
        accessorFn: (r) => r.patient.name,
        cell: ({ row }) => (
          <PatientCell
            id={row.original.patient.id}
            name={row.original.patient.name}
            sub={row.original.patient.mrn ?? row.original.patient.phone}
          />
        ),
      },
      {
        accessorKey: 'invoiceNumber',
        header: 'Invoice',
        cell: ({ row }) => (
          <Link
            to="/invoices/$invoiceId"
            params={{ invoiceId: row.original.id }}
            className="font-mono text-[13px] font-semibold hover:text-primary"
          >
            {row.original.invoiceNumber}
          </Link>
        ),
      },
      {
        accessorKey: 'dueDate',
        header: 'Due',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            {formatDate(row.original.dueDate)}
            {row.original.paymentStatus === 'OVERDUE' && (
              <Badge variant="danger" className="px-1.5 py-0 text-[10px]">
                Overdue
              </Badge>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'balanceDue',
        header: 'Balance',
        cell: ({ row }) => (
          <Money value={row.original.balanceDue} className="font-semibold" />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Can perm="billing.payment.collect">
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setPatient(row.original.patient)}
              >
                Collect
              </Button>
            </Can>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <PageWrapper
      title="Billing desk"
      subtitle="Bill finished visits and follow up on dues"
      actions={
        <div className="w-[160px]">
          <DatePicker
            className="h-8 text-xs"
            value={date}
            onChange={setDate}
            placeholder="Today"
            clearable
          />
        </div>
      }
    >
      {settings.data && !settings.data.documentCode && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-soft px-3 py-2 text-xs text-amber"
          role="alert"
        >
          <AlertTriangle className="size-3.5" />
          This location has no document code, so invoices and receipts cannot be
          numbered yet.
          {can('admin.settings.manage') && (
            <Link to="/settings/billing" className="font-semibold underline">
              Set it in billing settings
            </Link>
          )}
        </div>
      )}

      <section className="space-y-2">
        <SectionHeading
          icon={Clock4}
          title="Ready to bill"
          description="Patients with charges not invoiced yet"
        />
        {ready.isLoading ? (
          <LoadingSkeleton variant="table" rows={3} />
        ) : ready.isError ? (
          <ErrorState onRetry={() => void ready.refetch()} />
        ) : (
          <DataTable
            columns={readyColumns}
            data={ready.data ?? []}
            defaultPageSize={10}
            emptyMessage="Nobody is waiting to be billed. Completed consultations appear here."
          />
        )}
      </section>

      <section className="space-y-2">
        <SectionHeading
          icon={Wallet}
          title="Outstanding"
          description="Overdue and unpaid invoices"
        />
        {overdue.isLoading || unpaid.isLoading ? (
          <LoadingSkeleton variant="table" rows={3} />
        ) : (
          <DataTable
            columns={dueColumns}
            data={outstanding}
            defaultPageSize={10}
            emptyMessage="No dues — every issued invoice is paid."
          />
        )}
      </section>

      {patient && (
        <CollectPaymentSheet
          patient={patient}
          open
          onOpenChange={(o) => !o && setPatient(null)}
        />
      )}
    </PageWrapper>
  )
}
