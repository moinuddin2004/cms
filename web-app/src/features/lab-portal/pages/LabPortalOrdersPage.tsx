import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { useNavigate } from '@tanstack/react-router'
import { ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { ListToolbar } from '@/components/shared/ListToolbar'
import { OrderStatusBadge, statusLabel } from '@/features/lab-orders'
import { useDebounce } from '@/hooks/useDebounce'
import { LabPortalLayout } from '../components/LabPortalLayout'
import { usePortalOrders } from '../hooks/usePortalOrders'
import { PORTAL_ORDER_STATUSES } from '../types'
import type { PortalOrderRow } from '../types'

const ALL = 'all'
const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })
    : '—'

/**
 * The lab's order inbox (lab ERD §13): every submitted order from the
 * clinics it works with. Patients appear only as the clinic allows.
 */
export function LabPortalOrdersPage() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>(ALL)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const query = useDebounce(search, 300).trim()

  const { data, isLoading, isError, refetch, isFetching } = usePortalOrders({
    page,
    limit,
    search: query || undefined,
    status: status === ALL ? undefined : status,
  })
  const activeFilters = (query ? 1 : 0) + (status !== ALL ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setStatus(ALL)
    setPage(1)
  }
  const open = (o: { id: string }) =>
    void navigate({
      to: '/lab-portal/orders/$orderId',
      params: { orderId: o.id },
    })

  const columns = useMemo<ColumnDef<PortalOrderRow, unknown>[]>(
    () => [
      {
        id: 'order',
        header: 'Order',
        accessorFn: (o) => o.orderNo ?? '',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {row.original.orderNo}
            </span>
            {row.original.priority === 'urgent' && (
              <Badge variant="warning">Urgent</Badge>
            )}
          </div>
        ),
      },
      { id: 'clinic', header: 'Clinic', accessorFn: (o) => o.clinic.name },
      { id: 'patient', header: 'Patient', accessorFn: (o) => o.patient.ref },
      {
        id: 'doctor',
        header: 'Doctor',
        accessorFn: (o) => o.doctor?.fullName ?? '—',
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
      },
      {
        id: 'due',
        header: 'Due',
        accessorFn: (o) => o.labExpectedOn ?? '',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {fmtDate(row.original.labExpectedOn)}
          </span>
        ),
      },
      {
        id: 'received',
        header: 'Received',
        accessorFn: (o) => o.submittedAt ?? '',
        cell: ({ row }) => (
          <span className="text-sm text-text-2">
            {fmtDate(row.original.submittedAt)}
          </span>
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
    <LabPortalLayout
      title="Orders"
      subtitle="Work sent to your lab. Accept new orders with the date they’ll be ready."
    >
      <div className="space-y-4">
        <ListToolbar
          search={search}
          onSearch={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search order no. or clinic…"
          activeFilters={activeFilters}
          onClear={clearFilters}
          resultLabel={
            isFetching && !isLoading
              ? 'Updating…'
              : `${total} order${total === 1 ? '' : 's'}`
          }
          viewMode={viewMode}
          onViewMode={setViewMode}
          filters={
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-9 w-48" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {PORTAL_ORDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        {isLoading ? (
          <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : total === 0 && activeFilters === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No orders yet"
            description="When a clinic sends your lab an order, it shows up here — and on WhatsApp if the clinic sends you a link."
          />
        ) : total === 0 ? (
          <NoResultsState
            message="No orders match your filters."
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
              {rows.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => open(o)}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {o.orderNo}
                        {o.priority === 'urgent' ? ' · Urgent' : ''}
                      </p>
                      <p className="truncate text-xs text-text-3">
                        {o.clinic.name} · {o.patient.ref}
                      </p>
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2 text-xs text-text-3">
                    <span>{o.doctor?.fullName ?? '—'}</span>
                    <span>Due {fmtDate(o.labExpectedOn)}</span>
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
    </LabPortalLayout>
  )
}
