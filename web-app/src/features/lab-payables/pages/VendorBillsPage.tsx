import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
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
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DatePicker } from '@/components/shared/DatePicker'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { formatPaisa } from '@/features/lab-catalog'
import { useDebounce } from '@/hooks/useDebounce'
import {
  BILL_STATUS_OPTIONS,
  BillStatusBadge,
} from '../components/payables-badges'
import {
  ALL,
  LabFilter,
  PayablesNav,
  useClinicLabs,
} from '../components/PayablesNav'
import { useVendorBills } from '../hooks/useLabPayables'
import type { VendorBill } from '../types'

/**
 * What the clinic owes its labs (lab ERD §6b): one draft per order is made
 * when the lab accepts; the accountant matches it with the lab's invoice,
 * approves and pays.
 */
export function VendorBillsPage() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(ALL)
  const [labId, setLabId] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const query = useDebounce(search, 300).trim()
  const labs = useClinicLabs()

  const params = {
    page,
    limit,
    search: query || undefined,
    status: status === ALL ? undefined : status,
    labId: labId === ALL ? undefined : labId,
    from: from || undefined,
    to: to || undefined,
  }
  const { data, isLoading, isError, refetch, isFetching } =
    useVendorBills(params)
  const activeFilters =
    (query ? 1 : 0) +
    (status !== ALL ? 1 : 0) +
    (labId !== ALL ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setStatus(ALL)
    setLabId(ALL)
    setFrom('')
    setTo('')
    setPage(1)
  }
  const open = (b: VendorBill) =>
    void navigate({
      to: '/lab-payables/bills/$billId',
      params: { billId: b.id },
    })

  const columns = useMemo<ColumnDef<VendorBill, unknown>[]>(
    () => [
      {
        id: 'bill',
        header: 'Bill',
        accessorKey: 'billNo',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold">{row.original.billNo}</p>
            <p className="text-xs text-text-3">
              {row.original.orderNo ?? 'Manual'}
              {row.original.vendorInvoiceNo
                ? ` · ${row.original.vendorInvoiceNo}`
                : ''}
            </p>
          </div>
        ),
      },
      { id: 'lab', header: 'Lab', accessorFn: (b) => b.labName ?? '' },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <BillStatusBadge status={row.original.status} />,
      },
      { id: 'date', header: 'Bill date', accessorKey: 'billDate' },
      { id: 'due', header: 'Due', accessorFn: (b) => b.dueOn ?? '—' },
      {
        id: 'total',
        header: 'Total',
        accessorKey: 'totalPaisa',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatPaisa(row.original.totalPaisa)}
          </span>
        ),
      },
      {
        id: 'balance',
        header: 'Balance',
        accessorKey: 'balancePaisa',
        cell: ({ row }) => (
          <span className="tabular-nums font-medium">
            {row.original.status === 'draft'
              ? '—'
              : formatPaisa(row.original.balancePaisa)}
          </span>
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
    <DashboardLayout
      title="Lab payables"
      subtitle="Vendor bills from your labs — review, approve, pay."
    >
      <div className="space-y-4">
        <PayablesNav active="/lab-payables" />
        <ListToolbar
          search={search}
          onSearch={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search bill, order or lab invoice no…"
          activeFilters={activeFilters}
          onClear={clearFilters}
          resultLabel={
            isFetching && !isLoading
              ? 'Updating…'
              : `${total} bill${total === 1 ? '' : 's'}`
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
                <SelectTrigger
                  className="h-9 w-40"
                  aria-label="Filter by status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {BILL_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <LabFilter
                value={labId}
                labs={labs}
                onChange={(v) => {
                  setLabId(v)
                  setPage(1)
                }}
              />
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
            title="No vendor bills yet"
            description="A draft bill appears here as soon as a lab accepts an order, priced at the lab cost fixed on the order."
          />
        ) : total === 0 ? (
          <NoResultsState
            message="No bills match your filters."
            onClear={clearFilters}
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
              {rows.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => open(b)}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{b.billNo}</p>
                      <p className="truncate text-xs text-text-3">
                        {b.labName} · {b.orderNo ?? 'Manual'}
                      </p>
                    </div>
                    <BillStatusBadge status={b.status} />
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2 text-xs text-text-3">
                    <span>{b.dueOn ? `Due ${b.dueOn}` : b.billDate}</span>
                    <span className="tabular-nums font-medium text-foreground">
                      {formatPaisa(
                        b.status === 'draft' ? b.totalPaisa : b.balancePaisa,
                      )}
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
    </DashboardLayout>
  )
}
