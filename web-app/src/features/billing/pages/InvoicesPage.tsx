import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import {
  AlertCircle,
  Ban,
  Eye,
  FileText,
  HandCoins,
  LayoutGrid,
  List,
  MoreHorizontal,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  TrendingUp,
  Undo2,
  Wallet,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/shared/DataTable'
import {
  ErrorState,
  LoadingSkeleton,
  PageWrapper,
  Pagination,
} from '@/components/shared'
import { useDebounce } from '@/hooks/useDebounce'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useInvoiceList, useInvoiceStatsV2 } from '../hooks/use-billing-queries'
import { toastBillingError } from '../lib/billing-errors'
import type {
  Invoice,
  InvoiceListStatus,
  InvoiceStatsV2,
} from '../types/billing.types'
import { CollectPaymentSheet } from '../components/collect-payment/CollectPaymentSheet'
import { printDocument } from '../components/print/print-document'
import { Money } from '../components/shared/billing-badges'
import {
  DatePresetBar,
  presetRange,
  StatsStrip,
} from '../components/shared/list-toolbar'
import type { DateRange, RangePreset } from '../components/shared/list-toolbar'

// ─── Filters ────────────────────────────────────────────────────────

type StatusFilter = InvoiceListStatus | 'all'

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PARTIALLY_PAID', label: 'Partial' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PAID', label: 'Paid' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

// ─── Status pill (same shape as the appointments list) ──────────────

const PILL: Record<string, { label: string; className: string }> = {
  PAID: {
    label: 'Paid',
    className: 'border-emerald/20 bg-emerald-soft text-emerald',
  },
  PARTIALLY_PAID: {
    label: 'Partially paid',
    className: 'border-amber/20 bg-amber-soft text-amber',
  },
  UNPAID: {
    label: 'Unpaid',
    className: 'border-border bg-panel-2 text-text-2',
  },
  OVERDUE: {
    label: 'Overdue',
    className: 'border-danger/20 bg-danger-soft text-danger',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'border-border bg-panel-2 text-text-3',
  },
  REFUNDED: {
    label: 'Refunded',
    className: 'border-violet/20 bg-violet-soft text-violet',
  },
}

function StatusPill({ invoice }: { invoice: Invoice }) {
  const key =
    invoice.status === 'CANCELLED'
      ? 'CANCELLED'
      : invoice.refundStatus === 'FULLY_REFUNDED'
        ? 'REFUNDED'
        : (invoice.paymentStatus ?? 'UNPAID')
  const pill = PILL[key]
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={cn(
          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
          pill.className,
        )}
      >
        {pill.label}
      </span>
      {invoice.refundStatus === 'PARTIALLY_REFUNDED' && (
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
            PILL.REFUNDED.className,
          )}
        >
          −{formatCurrency(invoice.refundedAmount)}
        </span>
      )}
    </span>
  )
}

// ─── Stats strip ───────────────────────────────────────────────────

function InvoiceStatsStrip({
  stats,
  isLoading,
}: {
  stats?: InvoiceStatsV2
  isLoading: boolean
}) {
  const t = stats?.totals
  const issued = stats
    ? Object.entries(stats.counts)
        .filter(([k]) => k !== 'REFUNDED')
        .reduce((a, [, n]) => a + n, 0)
    : 0
  return (
    <StatsStrip
      isLoading={isLoading || !stats}
      items={[
        {
          key: 'count',
          label: 'Invoices',
          value: issued,
          icon: FileText,
          color: 'text-primary-text',
          bg: 'bg-primary-soft',
        },
        {
          key: 'invoiced',
          label: 'Invoiced',
          value: formatCurrency(t?.invoiced ?? 0),
          icon: Receipt,
          color: 'text-primary-text',
          bg: 'bg-primary-soft',
        },
        {
          key: 'collected',
          label: 'Collected',
          value: formatCurrency(t?.collected ?? 0),
          icon: TrendingUp,
          color: 'text-emerald',
          bg: 'bg-emerald-soft',
        },
        {
          key: 'outstanding',
          label: 'Outstanding',
          value: formatCurrency(t?.outstanding ?? 0),
          icon: Wallet,
          color: 'text-amber',
          bg: 'bg-amber-soft',
        },
        {
          key: 'overdue',
          label: 'Overdue',
          value: formatCurrency(t?.overdue ?? 0),
          icon: AlertCircle,
          color: 'text-danger',
          bg: 'bg-danger-soft',
        },
        {
          key: 'refunded',
          label: 'Refunded',
          value: formatCurrency(t?.refunded ?? 0),
          icon: Undo2,
          color: 'text-violet',
          bg: 'bg-violet-soft',
        },
      ]}
    />
  )
}

// ─── Page ───────────────────────────────────────────────────────────

/** Invoices — laid out like the Appointments list view. */
export function InvoicesPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<'list' | 'cards'>('list')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput.trim(), 300)
  const [preset, setPreset] = useState<RangePreset>('all')
  const [custom, setCustom] = useState<DateRange>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [collectFor, setCollectFor] = useState<Invoice | null>(null)

  const range = useMemo(() => presetRange(preset, custom), [preset, custom])
  const list = useInvoiceList({
    paymentStatus: status === 'all' ? undefined : status,
    search: search || undefined,
    ...range,
    page,
    limit: pageSize,
  })
  const stats = useInvoiceStatsV2(range)
  const rows = list.data?.data ?? []
  const total = list.data?.total ?? 0

  const hasActiveFilters = status !== 'all' || !!search || preset !== 'all'
  const clearFilters = useCallback(() => {
    setStatus('all')
    setSearchInput('')
    setPreset('all')
    setCustom({})
    setPage(1)
  }, [])

  const openInvoice = useCallback(
    (id: string) =>
      void navigate({ to: '/invoices/$invoiceId', params: { invoiceId: id } }),
    [navigate],
  )
  const print = useCallback((id: string) => {
    printDocument('invoice', id).catch(toastBillingError)
  }, [])

  const columns = useMemo<ColumnDef<Invoice, unknown>[]>(
    () => [
      {
        id: 'date',
        accessorKey: 'issueDate',
        header: 'Date',
        cell: ({ row }) => (
          <div className="font-medium">
            <div>{formatDate(row.original.issueDate)}</div>
            <div className="text-xs text-muted-foreground">
              Due {formatDate(row.original.dueDate)}
            </div>
          </div>
        ),
      },
      {
        id: 'number',
        accessorKey: 'invoiceNumber',
        header: 'Invoice',
        cell: ({ row }) => (
          <div>
            <span className="font-mono text-[13px] font-semibold">
              {row.original.invoiceNumber}
            </span>
            {row.original.revision > 1 && (
              <div className="text-xs text-muted-foreground">
                Rev {row.original.revision}
              </div>
            )}
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
        id: 'total',
        accessorKey: 'totalAmount',
        header: 'Total',
        cell: ({ row }) => (
          <Money value={row.original.totalAmount} className="font-medium" />
        ),
      },
      {
        id: 'paid',
        accessorKey: 'paidAmount',
        header: 'Paid',
        cell: ({ row }) => (
          <Money
            value={row.original.paidAmount}
            className="text-muted-foreground"
          />
        ),
      },
      {
        id: 'balance',
        accessorKey: 'balanceDue',
        header: 'Balance',
        cell: ({ row }) => (
          <Money
            value={row.original.balanceDue}
            className={
              row.original.balanceDue > 0
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground'
            }
          />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => <StatusPill invoice={row.original} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const inv = row.original
          const canCollect = inv.status === 'ISSUED' && inv.balanceDue > 0
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Invoice actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {inv.invoiceNumber}
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => openInvoice(inv.id)}>
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    View details
                  </DropdownMenuItem>
                  {canCollect && (
                    <DropdownMenuItem onClick={() => setCollectFor(inv)}>
                      <HandCoins className="mr-2 h-3.5 w-3.5" />
                      Collect payment
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => print(inv.id)}>
                    <Printer className="mr-2 h-3.5 w-3.5" />
                    Print
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [openInvoice, print],
  )

  const viewToggle = (
    <div className="flex items-center rounded-lg border border-border bg-surface p-[3px]">
      {(
        [
          { key: 'list', icon: List, label: 'List' },
          { key: 'cards', icon: LayoutGrid, label: 'Cards' },
        ] as const
      ).map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => setView(key)}
          className={cn(
            'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            view === key
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-2 hover:text-foreground',
          )}
        >
          <Icon className="size-3" />
          {label}
        </button>
      ))}
    </div>
  )

  return (
    <>
      <PageWrapper
        title="Invoices"
        subtitle="Search issued invoices — status follows payments and due dates."
        actions={
          <div className="flex items-center gap-2.5">
            {viewToggle}
            <Button size="sm" asChild>
              <Link to="/billing">
                <HandCoins className="size-3.5" />
                Billing desk
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mt-5 space-y-4">
        <InvoiceStatsStrip stats={stats.data} isLoading={stats.isLoading} />

        {/* ── Toolbar: status tabs + search + dates ─────────────────── */}
        <div className="space-y-2 rounded-xl border bg-card px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center rounded-[9px] border border-border bg-surface p-[3px]">
              {STATUS_TABS.map((t) => {
                const count =
                  t.value !== 'all' ? stats.data?.counts[t.value] : undefined
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setStatus(t.value)
                      setPage(1)
                    }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-[7px] px-3 py-[5px] text-[13px] font-medium transition-colors',
                      status === t.value
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-text-2 hover:text-foreground',
                    )}
                  >
                    {t.label}
                    {count !== undefined && count > 0 && (
                      <span
                        className={cn(
                          'rounded-full px-1.5 text-[10px] tabular-nums',
                          status === t.value
                            ? 'bg-white/20'
                            : 'bg-panel-2 text-text-3',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {list.isFetching && !list.isLoading && (
              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                live
              </span>
            )}
          </div>

          <div className="flex flex-row flex-wrap items-center gap-2 border-t pt-2">
            <div className="relative max-w-xs min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value)
                  setPage(1)
                }}
                placeholder="Invoice no., patient or phone..."
                aria-label="Search invoices"
                className="h-8 pl-9 pr-9 text-xs"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-accent"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            <DatePresetBar
              presets={['today', 'month', 'past30', 'all']}
              preset={preset}
              custom={custom}
              onChange={(p, c) => {
                setPreset(p)
                setCustom(c)
                setPage(1)
              }}
              fallback="all"
            />

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw size={13} className="mr-1.5" />
                Reset
              </Button>
            )}

            {total > 0 && (
              <div className="ml-auto text-xs text-muted-foreground">
                {total} invoice{total === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </div>

        {/* ── Results ───────────────────────────────────────────────── */}
        {list.isError ? (
          <ErrorState onRetry={() => void list.refetch()} />
        ) : view === 'list' ? (
          <DataTable
            columns={columns}
            data={rows}
            isLoading={list.isLoading}
            skeletonRows={pageSize}
            emptyMessage={
              hasActiveFilters
                ? 'No invoices match these filters.'
                : 'No invoices yet — they are issued when reception collects a payment.'
            }
            emptyAction={
              hasActiveFilters ? (
                <Button
                  variant="link"
                  size="sm"
                  onClick={clearFilters}
                  className="h-6"
                >
                  Clear filters
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/billing">
                    <HandCoins className="mr-2 h-4 w-4" />
                    Open billing desk
                  </Link>
                </Button>
              )
            }
            onRowClick={(inv) => openInvoice(inv.id)}
            getRowClassName={(inv) =>
              inv.status === 'CANCELLED' ? 'opacity-50' : undefined
            }
            serverPagination={{
              page,
              pageSize,
              total,
              onPageChange: setPage,
              onPageSizeChange: (s) => {
                setPageSize(s)
                setPage(1)
              },
              pageSizeOptions: [10, 25, 50, 100],
            }}
          />
        ) : list.isLoading ? (
          <LoadingSkeleton variant="cards" />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">
            {hasActiveFilters
              ? 'No invoices match these filters.'
              : 'No invoices yet.'}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((inv) => (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  onOpen={() => openInvoice(inv.id)}
                />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={list.data?.totalPages ?? 1}
              limit={pageSize}
              total={total}
              onPageChange={setPage}
              onLimitChange={(s) => {
                setPageSize(s)
                setPage(1)
              }}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </div>

      {collectFor && (
        <CollectPaymentSheet
          patient={collectFor.patient}
          open
          onOpenChange={(o) => !o && setCollectFor(null)}
          preselectChargeIds={undefined}
        />
      )}
    </>
  )
}

function InvoiceCard({
  invoice: inv,
  onOpen,
}: {
  invoice: Invoice
  onOpen: () => void
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className={cn(
        'group cursor-pointer gap-0 py-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
        inv.status === 'CANCELLED' && 'opacity-60',
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[13px] font-semibold">
              {inv.invoiceNumber}
            </p>
            <p dir="auto" className="truncate text-sm font-medium">
              {inv.patient.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {inv.patient.phone || inv.patient.mrn || '—'}
            </p>
          </div>
          <StatusPill invoice={inv} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatDate(inv.issueDate)}</span>
          <span>Due {formatDate(inv.dueDate)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
          <Money value={inv.totalAmount} className="font-semibold" />
          {inv.status === 'CANCELLED' ? (
            <span className="flex items-center gap-1 text-xs text-text-3">
              <Ban className="size-3" /> Cancelled
            </span>
          ) : inv.balanceDue > 0 ? (
            <span className="text-xs font-medium text-danger">
              Due {formatCurrency(inv.balanceDue)}
            </span>
          ) : (
            <span className="text-xs text-emerald">Settled</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
