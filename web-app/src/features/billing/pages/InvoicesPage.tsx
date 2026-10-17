import { useCallback, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertCircle, FileText, TrendingUp, Wallet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import {
  EmptyState,
  ErrorState,
  InitialsAvatar,
  LoadingSkeleton,
  NoResultsState,
  PageWrapper,
  Pagination,
  StatCard,
  ViewToggle,
} from '@/components/shared'
import type { ViewMode } from '@/components/shared'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useInvoiceList, useInvoiceStatsV2 } from '../hooks/use-billing-queries'
import type { Invoice, InvoiceListStatus } from '../types/billing.types'
import { InvoiceTable } from '../components/invoices/InvoiceTable'
import { Money, PaymentStatusBadge } from '../components/shared/billing-badges'
import {
  FilterBar,
  FilterSearch,
  ResetFilters,
} from '../components/shared/billing-ui'
import { OptionSelect } from '../components/shared/OptionSelect'

const ALL = 'ALL'
const STATUSES: Array<{ value: InvoiceListStatus; label: string }> = [
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PARTIALLY_PAID', label: 'Partially paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'PAID', label: 'Paid' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

/** Invoices listing (plan §8.1), laid out like the Patients page. */
export function InvoicesPage() {
  const [status, setStatus] = useState<InvoiceListStatus | undefined>()
  const [search, setSearch] = useState('')
  const [range, setRange] = useState<{ from?: string; to?: string }>({})
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [view, setView] = useState<ViewMode>('table')

  const list = useInvoiceList({
    paymentStatus: status,
    search: search || undefined,
    ...range,
    page,
    limit,
  })
  const stats = useInvoiceStatsV2(range)
  const activeFilters = [status, search, range.from, range.to].filter(
    Boolean,
  ).length
  const reset = useCallback(() => {
    setStatus(undefined)
    setSearch('')
    setRange({})
    setPage(1)
  }, [])
  const onSearch = useCallback((v: string) => {
    setSearch(v.trim())
    setPage(1)
  }, [])

  const rows = list.data?.data ?? []
  const total = list.data?.total ?? 0
  const totals = stats.data?.totals

  return (
    <PageWrapper
      title="Invoices"
      subtitle={`${total} invoice${total !== 1 ? 's' : ''} · status follows payments and due dates`}
      actions={<ViewToggle value={view} onChange={setView} size="sm" />}
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Invoiced"
          value={formatCurrency(totals?.invoiced ?? 0)}
          icon={FileText}
        />
        <StatCard
          label="Collected"
          value={formatCurrency(totals?.collected ?? 0)}
          icon={TrendingUp}
          iconTone="emerald"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(totals?.outstanding ?? 0)}
          icon={Wallet}
          iconTone="amber"
        />
        <StatCard
          label="Overdue"
          value={formatCurrency(totals?.overdue ?? 0)}
          icon={AlertCircle}
          iconTone="danger"
        />
      </div>

      <FilterBar>
        <FilterSearch
          value={search}
          onChange={onSearch}
          placeholder="Invoice no., patient name or phone..."
          label="Search invoices"
        />
        <OptionSelect
          className="h-8 w-[160px] text-xs"
          value={status ?? ALL}
          onChange={(v) => {
            setStatus(v === ALL ? undefined : (v as InvoiceListStatus))
            setPage(1)
          }}
          options={[
            { value: ALL, label: 'All statuses' },
            ...STATUSES.map((s) => ({
              value: s.value,
              label: stats.data
                ? `${s.label} (${stats.data.counts[s.value]})`
                : s.label,
            })),
          ]}
        />
        <DateRangePicker
          aria-label="Invoice dates"
          className="h-8 w-[260px] text-xs"
          value={range}
          onChange={(r) => {
            setRange(r)
            setPage(1)
          }}
          placeholder="All dates"
        />
        <ResetFilters count={activeFilters} onReset={reset} />
      </FilterBar>

      {list.isLoading ? (
        <LoadingSkeleton variant={view === 'table' ? 'table' : 'cards'} />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        activeFilters ? (
          <NoResultsState onClear={reset} />
        ) : (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Invoices are issued when reception collects a payment or issues one from open charges."
          />
        )
      ) : view === 'table' ? (
        <InvoiceTable
          invoices={rows}
          serverPagination={{
            page,
            pageSize: limit,
            total,
            onPageChange: setPage,
            onPageSizeChange: (l) => {
              setLimit(l)
              setPage(1)
            },
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={list.data?.totalPages ?? 1}
            limit={limit}
            total={total}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l)
              setPage(1)
            }}
          />
        </>
      )}
    </PageWrapper>
  )
}

/** Card view tile, styled like PatientCard. */
function InvoiceCard({ invoice: inv }: { invoice: Invoice }) {
  return (
    <Card className="group relative overflow-hidden border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <CardContent className="p-5">
        <div className="mb-4 flex items-start gap-3">
          <InitialsAvatar
            name={inv.patient.name}
            seed={inv.patient.id}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to="/invoices/$invoiceId"
                  params={{ invoiceId: inv.id }}
                  className="block truncate font-mono text-sm font-semibold leading-tight text-foreground transition-colors hover:text-primary"
                >
                  {inv.invoiceNumber}
                </Link>
                <p
                  dir="auto"
                  className="mt-0.5 truncate text-xs text-muted-foreground"
                >
                  {inv.patient.name}
                </p>
              </div>
              <PaymentStatusBadge
                status={inv.status}
                paymentStatus={inv.paymentStatus}
                refundStatus={inv.refundStatus}
                refundedAmount={inv.refundedAmount}
              />
            </div>
          </div>
        </div>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Issued</span>
            <span>{formatDate(inv.issueDate)}</span>
          </div>
          <div className="flex justify-between">
            <span>Due</span>
            <span>{formatDate(inv.dueDate)}</span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
          <Money value={inv.totalAmount} className="text-sm font-semibold" />
          {inv.balanceDue > 0 ? (
            <span className="text-xs text-danger">
              Due <Money value={inv.balanceDue} />
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Settled</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
