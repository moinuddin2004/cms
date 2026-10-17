import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Banknote, Lock, ReceiptText, Undo2, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/DataTable'
import { DatePicker } from '@/components/shared/DatePicker'
import {
  ErrorState,
  InitialsAvatar,
  LoadingSkeleton,
  PageWrapper,
  StatCard,
} from '@/components/shared'
import { formatCurrency } from '@/lib/formatters'
import {
  useCashCloseHistory,
  useDailyCollection,
  usePaymentList,
} from '../hooks/use-billing-queries'
import type {
  CashClose,
  DailyCollection,
  Payment,
} from '../types/billing.types'
import { CashCloseSheet } from '../components/cash-close/CashCloseSheet'
import { PrintButton } from '../components/print/PrintButton'
import { Money } from '../components/shared/billing-badges'
import { SectionHeading } from '../components/shared/billing-ui'

type AccountRow = DailyCollection['accounts'][number]

/** Daily collection per payment account, receipts, counter closes (plan §8.3). */
export function PaymentsPage() {
  const [date, setDate] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [closeOpen, setCloseOpen] = useState(false)
  const daily = useDailyCollection(date)
  const day = daily.data?.date
  const payments = usePaymentList({ from: day, to: day, page, limit })

  const accountColumns = useMemo<ColumnDef<AccountRow, unknown>[]>(
    () => [
      {
        accessorKey: 'paymentAccountName',
        header: 'Account',
        cell: ({ row }) => (
          <span className="font-medium">{row.original.paymentAccountName}</span>
        ),
      },
      {
        accessorKey: 'paymentsTotal',
        header: 'Payments',
        cell: ({ row }) => (
          <span>
            <Money value={row.original.paymentsTotal} />{' '}
            <span className="text-xs text-muted-foreground">
              ({row.original.paymentCount})
            </span>
          </span>
        ),
      },
      {
        accessorKey: 'refundsTotal',
        header: 'Refunds',
        cell: ({ row }) => (
          <span>
            <Money value={row.original.refundsTotal} />{' '}
            <span className="text-xs text-muted-foreground">
              ({row.original.refundCount})
            </span>
          </span>
        ),
      },
      {
        accessorKey: 'net',
        header: 'Net',
        cell: ({ row }) => (
          <Money value={row.original.net} className="font-semibold" />
        ),
      },
    ],
    [],
  )

  const receiptColumns = useMemo<ColumnDef<Payment, unknown>[]>(
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
        id: 'patient',
        header: 'Patient',
        accessorFn: (r) => r.patient.name,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <InitialsAvatar
              name={row.original.patient.name}
              seed={row.original.patient.id}
              size="sm"
            />
            <span dir="auto" className="text-sm font-semibold">
              {row.original.patient.name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'paymentAccountName',
        header: 'Account',
        cell: ({ row }) => (
          <div>
            <p className="text-sm">{row.original.paymentAccountName}</p>
            {row.original.referenceNumber && (
              <p className="font-mono text-[11px] text-muted-foreground">
                {row.original.referenceNumber}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'by',
        header: 'Received by',
        accessorFn: (r) => r.receivedByName ?? '—',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <Money value={row.original.amount} className="font-semibold" />
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

  const totals = daily.data?.totals
  return (
    <PageWrapper
      title="Payments"
      subtitle="Collections per payment account, refunds subtracted"
      actions={
        <>
          <div className="w-[160px]">
            <DatePicker
              className="h-8 text-xs"
              value={date}
              onChange={(d) => {
                setDate(d)
                setPage(1)
              }}
              placeholder="Today"
              clearable
            />
          </div>
          <Button size="sm" onClick={() => setCloseOpen(true)}>
            <Lock className="size-3.5" /> Close counter
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Collected"
          value={formatCurrency(totals?.payments ?? 0)}
          icon={Banknote}
          iconTone="emerald"
        />
        <StatCard
          label="Refunded"
          value={formatCurrency(totals?.refunds ?? 0)}
          icon={Undo2}
          iconTone="violet"
        />
        <StatCard
          label="Net in hand"
          value={formatCurrency(totals?.net ?? 0)}
          icon={Wallet}
        />
      </div>

      <section className="space-y-2">
        <SectionHeading icon={Wallet} title="By payment account" />
        {daily.isLoading ? (
          <LoadingSkeleton variant="table" rows={3} />
        ) : daily.isError ? (
          <ErrorState onRetry={() => void daily.refetch()} />
        ) : (
          <DataTable
            columns={accountColumns}
            data={daily.data?.accounts ?? []}
            pagination={false}
            emptyMessage="No payment accounts yet."
          />
        )}
      </section>

      <section className="space-y-2">
        <SectionHeading icon={ReceiptText} title="Receipts" />
        {payments.isLoading ? (
          <LoadingSkeleton variant="table" rows={4} />
        ) : payments.isError ? (
          <ErrorState onRetry={() => void payments.refetch()} />
        ) : (
          <DataTable
            columns={receiptColumns}
            data={payments.data?.data ?? []}
            emptyMessage="No payments on this day."
            serverPagination={{
              page,
              pageSize: limit,
              total: payments.data?.total ?? 0,
              onPageChange: setPage,
              onPageSizeChange: (l) => {
                setLimit(l)
                setPage(1)
              },
            }}
          />
        )}
      </section>

      <CashCloseHistory />
      <CashCloseSheet open={closeOpen} onOpenChange={setCloseOpen} />
    </PageWrapper>
  )
}

export function CashCloseHistory() {
  const history = useCashCloseHistory()
  const columns = useMemo<ColumnDef<CashClose, unknown>[]>(
    () => [
      {
        accessorKey: 'periodEnd',
        header: 'Period',
        cell: ({ row }) => (
          <span className="text-sm">
            {new Date(row.original.periodStart).toLocaleString()} –{' '}
            {new Date(row.original.periodEnd).toLocaleTimeString()}
          </span>
        ),
      },
      {
        id: 'by',
        header: 'Closed by',
        accessorFn: (r) => r.closedByName ?? '—',
      },
      {
        accessorKey: 'totalExpected',
        header: 'Expected',
        cell: ({ row }) => <Money value={row.original.totalExpected} />,
      },
      {
        accessorKey: 'totalCounted',
        header: 'Counted',
        cell: ({ row }) => <Money value={row.original.totalCounted} />,
      },
      {
        accessorKey: 'totalVariance',
        header: 'Variance',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            <Money
              value={row.original.totalVariance}
              className={
                row.original.totalVariance < 0 ? 'text-danger' : undefined
              }
            />
            {row.original.flagged && (
              <Badge variant="danger" className="px-1.5 py-0 text-[10px]">
                Flagged
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
              documentType="cash-close"
              id={row.original.id}
              label="Slip"
            />
          </div>
        ),
      },
    ],
    [],
  )
  return (
    <section className="space-y-2">
      <SectionHeading icon={Lock} title="Counter closes" />
      {history.isLoading ? (
        <LoadingSkeleton variant="table" rows={3} />
      ) : history.isError ? (
        <ErrorState onRetry={() => void history.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={history.data ?? []}
          emptyMessage="No counter closes yet."
        />
      )}
    </section>
  )
}
