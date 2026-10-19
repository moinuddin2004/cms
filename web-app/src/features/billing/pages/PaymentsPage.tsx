import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Lock,
  MoreHorizontal,
  Printer,
  ReceiptText,
  Undo2,
  UserRound,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTable } from '@/components/shared/DataTable'
import { DatePicker } from '@/components/shared/DatePicker'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { ErrorState, PageWrapper } from '@/components/shared'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import {
  useCashCloseHistory,
  useDailyCollection,
  usePaymentAccounts,
  usePaymentList,
} from '../hooks/use-billing-queries'
import { toastBillingError } from '../lib/billing-errors'
import type {
  CashClose,
  DailyCollection,
  Payment,
} from '../types/billing.types'
import { CashCloseSheet } from '../components/cash-close/CashCloseSheet'
import { printDocument } from '../components/print/print-document'
import { Money } from '../components/shared/billing-badges'
import { SectionHeading } from '../components/shared/billing-ui'
import {
  ListToolbar,
  LiveDot,
  StatsStrip,
} from '../components/shared/list-toolbar'
import { OptionSelect } from '../components/shared/OptionSelect'

type AccountRow = DailyCollection['accounts'][number]
const ALL = 'ALL'
const ymd = (d: Date) => d.toLocaleDateString('en-CA')
const shift = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

/** Payments — the day's collection per account, receipts and counter closes (Appointments layout). */
export function PaymentsPage() {
  const navigate = useNavigate()
  const today = ymd(new Date())
  const [day, setDay] = useState(today)
  const [accountId, setAccountId] = useState(ALL)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [closeOpen, setCloseOpen] = useState(false)

  const accounts = usePaymentAccounts()
  const daily = useDailyCollection(day)
  const payments = usePaymentList({
    from: day,
    to: day,
    page,
    limit: pageSize,
    ...(accountId !== ALL ? { paymentAccountId: accountId } : {}),
  })
  const goTo = (d: string) => {
    setDay(d)
    setPage(1)
  }
  const print = useCallback((id: string) => {
    printDocument('receipt', id).catch(toastBillingError)
  }, [])

  const totals = daily.data?.totals
  const receiptCount =
    daily.data?.accounts.reduce((a, r) => a + r.paymentCount, 0) ?? 0

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
          <div>
            <Money value={row.original.paymentsTotal} className="font-medium" />
            <div className="text-xs text-muted-foreground">
              {row.original.paymentCount} receipt(s)
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'refundsTotal',
        header: 'Refunds',
        cell: ({ row }) => (
          <div>
            <Money value={row.original.refundsTotal} />
            <div className="text-xs text-muted-foreground">
              {row.original.refundCount} refund(s)
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'net',
        header: 'Net',
        cell: ({ row }) => (
          <Money
            value={row.original.net}
            className="font-semibold text-foreground"
          />
        ),
      },
    ],
    [],
  )

  const receiptColumns = useMemo<ColumnDef<Payment, unknown>[]>(
    () => [
      {
        id: 'time',
        accessorKey: 'receivedAt',
        header: 'Time',
        cell: ({ row }) => (
          <div className="font-medium">
            {new Date(row.original.receivedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            <div className="font-mono text-xs text-muted-foreground">
              {row.original.receiptNumber}
            </div>
          </div>
        ),
      },
      {
        id: 'patient',
        header: 'Patient',
        enableSorting: false,
        cell: ({ row }) => (
          <div>
            <div dir="auto" className="max-w-[200px] truncate font-medium">
              {row.original.patient.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.patient.phone || row.original.patient.mrn || '—'}
            </div>
          </div>
        ),
      },
      {
        id: 'account',
        accessorKey: 'paymentAccountName',
        header: 'Account',
        cell: ({ row }) => (
          <div>
            <div className="text-sm">{row.original.paymentAccountName}</div>
            {row.original.referenceNumber && (
              <div className="font-mono text-xs text-muted-foreground">
                {row.original.referenceNumber}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'by',
        header: 'Received by',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.receivedByName ?? '—'}
          </span>
        ),
      },
      {
        id: 'amount',
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <div>
            <Money
              value={row.original.amount}
              className="font-semibold text-foreground"
            />
            {row.original.refundedAmount > 0 && (
              <div className="text-xs text-violet">
                −{formatCurrency(row.original.refundedAmount)} refunded
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Receipt actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {row.original.receiptNumber}
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => print(row.original.id)}>
                  <Printer className="mr-2 h-3.5 w-3.5" />
                  Print receipt
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    void navigate({
                      to: '/patients/$patientId',
                      params: { patientId: row.original.patient.id },
                    })
                  }
                >
                  <UserRound className="mr-2 h-3.5 w-3.5" />
                  Open patient
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [navigate, print],
  )

  return (
    <>
      <PageWrapper
        title="Payments"
        subtitle="The day's collection per payment account, refunds subtracted."
        actions={
          <Button size="sm" onClick={() => setCloseOpen(true)}>
            <Lock className="size-3.5" />
            Close counter
          </Button>
        }
      />

      <div className="mt-5 space-y-4">
        <StatsStrip
          isLoading={daily.isLoading}
          items={[
            {
              key: 'receipts',
              label: 'Receipts',
              value: receiptCount,
              icon: ReceiptText,
              color: 'text-primary-text',
              bg: 'bg-primary-soft',
            },
            {
              key: 'collected',
              label: 'Collected',
              value: formatCurrency(totals?.payments ?? 0),
              icon: Banknote,
              color: 'text-emerald',
              bg: 'bg-emerald-soft',
            },
            {
              key: 'refunded',
              label: 'Refunded',
              value: formatCurrency(totals?.refunds ?? 0),
              icon: Undo2,
              color: 'text-violet',
              bg: 'bg-violet-soft',
            },
            {
              key: 'net',
              label: 'Net in hand',
              value: formatCurrency(totals?.net ?? 0),
              icon: Wallet,
              color: 'text-amber',
              bg: 'bg-amber-soft',
            },
          ]}
        />

        <ListToolbar
          left={
            <>
              <div className="flex items-center gap-2 rounded-lg border bg-background px-2 py-1">
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
                  Day
                </span>
                <DatePicker
                  value={day}
                  onChange={(v) => v && goTo(v)}
                  hideIcon
                  max={today}
                  className="h-6 w-auto border-0 bg-transparent px-1 text-xs font-medium shadow-none hover:bg-accent"
                />
              </div>
              <div className="flex items-center">
                <TooltipButton
                  tooltip="Previous day"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-7"
                  onClick={() => goTo(shift(day, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </TooltipButton>
                <TooltipButton
                  tooltip="Next day"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-7"
                  disabled={day >= today}
                  onClick={() => goTo(shift(day, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </TooltipButton>
              </div>
              <div className="flex items-center gap-1">
                {[
                  { label: 'Today', value: today },
                  { label: 'Yesterday', value: shift(today, -1) },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => goTo(p.value)}
                    className={cn(
                      'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
                      day === p.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent',
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <LiveDot show={payments.isFetching && !payments.isLoading} />
            </>
          }
          right={
            <OptionSelect
              className="h-8 w-[170px] text-xs"
              value={accountId}
              onChange={(v) => {
                setAccountId(v)
                setPage(1)
              }}
              options={[
                { value: ALL, label: 'All accounts' },
                ...(accounts.data ?? []).map((a) => ({
                  value: a.id,
                  label: a.name,
                })),
              ]}
            />
          }
        />

        <section className="space-y-2">
          <SectionHeading icon={Wallet} title="By payment account" />
          {daily.isError ? (
            <ErrorState onRetry={() => void daily.refetch()} />
          ) : (
            <DataTable
              columns={accountColumns}
              data={daily.data?.accounts ?? []}
              isLoading={daily.isLoading}
              skeletonRows={3}
              pagination={false}
              emptyMessage="No payment accounts yet."
            />
          )}
        </section>

        <section className="space-y-2">
          <SectionHeading icon={ReceiptText} title="Receipts" />
          {payments.isError ? (
            <ErrorState onRetry={() => void payments.refetch()} />
          ) : (
            <DataTable
              columns={receiptColumns}
              data={payments.data?.data ?? []}
              isLoading={payments.isLoading}
              skeletonRows={pageSize}
              emptyMessage="No payments on this day."
              onRowClick={(p) => print(p.id)}
              serverPagination={{
                page,
                pageSize,
                total: payments.data?.total ?? 0,
                onPageChange: setPage,
                onPageSizeChange: (s) => {
                  setPageSize(s)
                  setPage(1)
                },
                pageSizeOptions: [10, 25, 50, 100],
              }}
            />
          )}
        </section>

        <CashCloseHistory />
      </div>

      <CashCloseSheet open={closeOpen} onOpenChange={setCloseOpen} />
    </>
  )
}

export function CashCloseHistory() {
  const history = useCashCloseHistory()
  const print = useCallback((id: string) => {
    printDocument('cash-close', id).catch(toastBillingError)
  }, [])
  const columns = useMemo<ColumnDef<CashClose, unknown>[]>(
    () => [
      {
        id: 'period',
        accessorKey: 'periodEnd',
        header: 'Period',
        cell: ({ row }) => (
          <div className="font-medium">
            {new Date(row.original.periodEnd).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
            <div className="text-xs text-muted-foreground">
              {new Date(row.original.periodStart).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              –{' '}
              {new Date(row.original.periodEnd).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        ),
      },
      {
        id: 'by',
        header: 'Closed by',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm">{row.original.closedByName ?? '—'}</span>
        ),
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
                row.original.totalVariance < 0
                  ? 'font-medium text-danger'
                  : row.original.totalVariance > 0
                    ? 'font-medium text-emerald'
                    : undefined
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
          <div
            className="flex justify-end"
            onClick={(e) => e.stopPropagation()}
          >
            <TooltipButton
              tooltip="Print slip"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => print(row.original.id)}
            >
              <Printer className="h-4 w-4 text-muted-foreground" />
            </TooltipButton>
          </div>
        ),
      },
    ],
    [print],
  )
  return (
    <section className="space-y-2">
      <SectionHeading icon={Lock} title="Counter closes" />
      {history.isError ? (
        <ErrorState onRetry={() => void history.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={history.data ?? []}
          isLoading={history.isLoading}
          skeletonRows={3}
          emptyMessage="No counter closes yet."
        />
      )}
    </section>
  )
}
