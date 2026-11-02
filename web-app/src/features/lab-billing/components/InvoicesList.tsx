import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { useNavigate } from '@tanstack/react-router'
import { Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  NoResultsState,
  Pagination,
} from '@/components/shared'
import type { ViewMode } from '@/components/shared'
import { DatePicker } from '@/components/shared/DatePicker'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { useDebounce } from '@/hooks/useDebounce'
import { useLabInvoices } from '../hooks/useLabBilling'
import type { LabInvoiceRow, LabInvoiceStatus } from '../types'
import {
  LabInvoiceStatusBadge,
  MoneyAmount,
  STATUS_OPTIONS,
} from './billing-bits'

const ALL = 'all'

/** Lab invoices + estimates: card and table views, filters, server paging. */
export function InvoicesList() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const query = useDebounce(search, 300).trim()

  const { data, isLoading, isError, isFetching, refetch } = useLabInvoices({
    page,
    limit,
    search: query || undefined,
    status:
      status === ALL ? undefined : (status as LabInvoiceStatus | 'overdue'),
    from: from || undefined,
    to: to || undefined,
  })
  const activeFilters =
    (query ? 1 : 0) + (status !== ALL ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0)
  const clear = () => {
    setSearch('')
    setStatus(ALL)
    setFrom('')
    setTo('')
    setPage(1)
  }
  const open = (i: { id: string }) =>
    void navigate({
      to: '/lab-billing/$invoiceId',
      params: { invoiceId: i.id },
    })

  const columns = useMemo<ColumnDef<LabInvoiceRow, unknown>[]>(
    () => [
      {
        id: 'invoice',
        header: 'Invoice',
        accessorFn: (i) => i.invoiceNo ?? '',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold">
              {row.original.invoiceNo ?? 'Estimate'}
            </p>
            <p className="text-xs text-text-3">
              {row.original.order?.orderNo ?? 'Manual'}
            </p>
          </div>
        ),
      },
      {
        id: 'patient',
        header: 'Patient',
        accessorFn: (i) => i.patient.fullName,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.patient.fullName}</p>
            <p className="text-xs text-text-3">
              {row.original.patient.patientNumber}
            </p>
          </div>
        ),
      },
      {
        id: 'issued',
        header: 'Issued',
        accessorFn: (i) => i.issuedOn ?? '',
        cell: ({ row }) => (
          <span className="text-sm">{row.original.issuedOn ?? '—'}</span>
        ),
      },
      {
        id: 'total',
        header: 'Total',
        accessorKey: 'totalMinor',
        cell: ({ row }) => <MoneyAmount value={row.original.totalMinor} />,
      },
      {
        id: 'paid',
        header: 'Paid',
        accessorKey: 'paidMinor',
        cell: ({ row }) => <MoneyAmount value={row.original.paidMinor} />,
      },
      {
        id: 'balance',
        header: 'Balance',
        accessorKey: 'balanceMinor',
        cell: ({ row }) => (
          <MoneyAmount
            value={
              row.original.status === 'draft' ? 0 : row.original.balanceMinor
            }
            strong
          />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <LabInvoiceStatusBadge
            status={row.original.status}
            overdue={row.original.overdue}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => open(row.original)}>
            Open
          </Button>
        ),
      },
    ],
    [],
  )

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const onPageSize = (size: number) => {
    setLimit(size)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <ListToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v)
          setPage(1)
        }}
        placeholder="Search invoice, order or patient…"
        activeFilters={activeFilters}
        onClear={clear}
        resultLabel={
          isFetching && !isLoading
            ? 'Updating…'
            : `${total} invoice${total === 1 ? '' : 's'}`
        }
        viewMode={viewMode}
        onViewMode={setViewMode}
        filters={
          <>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-9 w-40" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DatePicker
              value={from || undefined}
              onChange={(v) => {
                setFrom(v)
                setPage(1)
              }}
              placeholder="From"
              clearable
              className="h-9 w-36"
            />
            <DatePicker
              value={to || undefined}
              onChange={(v) => {
                setTo(v)
                setPage(1)
              }}
              placeholder="To"
              clearable
              className="h-9 w-36"
            />
          </>
        }
      />
      {isLoading ? (
        <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : total === 0 && activeFilters === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No lab invoices yet"
          description="Open a submitted lab order and bill its work from the Billing panel — the patient prices are already fixed on the order."
          action={
            <Button onClick={() => void navigate({ to: '/lab-orders' })}>
              Go to lab orders
            </Button>
          }
        />
      ) : total === 0 ? (
        <NoResultsState
          message="No invoices match your filters."
          onClear={clear}
        />
      ) : viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={rows}
          pagination={false}
          onRowClick={open}
          serverPagination={{
            page,
            pageSize: limit,
            total,
            onPageChange: setPage,
            onPageSizeChange: onPageSize,
            pageSizeOptions: [10, 20, 50, 100],
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => open(i)}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {i.invoiceNo ?? 'Estimate'}
                    </p>
                    <p className="truncate text-xs text-text-3">
                      {i.patient.fullName} · {i.order?.orderNo ?? 'Manual'}
                    </p>
                  </div>
                  <LabInvoiceStatusBadge
                    status={i.status}
                    overdue={i.overdue}
                  />
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2 text-xs text-text-3">
                  <span>{i.issuedOn ?? 'Not issued'}</span>
                  <span>
                    Total <MoneyAmount value={i.totalMinor} /> · Due{' '}
                    <MoneyAmount
                      value={i.status === 'draft' ? 0 : i.balanceMinor}
                      strong
                    />
                  </span>
                </div>
              </button>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / limit))}
            limit={limit}
            total={total}
            onPageChange={setPage}
            onLimitChange={onPageSize}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      )}
    </div>
  )
}
