import { useMemo, useState } from 'react'
import { formatInClinic } from '@/lib/datetime'
import type { ColumnDef } from '@/components/shared/table-features'
import { useNavigate } from '@tanstack/react-router'
import { FlaskConical, Plus } from 'lucide-react'
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
import { useDoctors } from '@/features/appointments'
import { formatMinor, useClinicServices } from '@/features/lab-catalog'
import { useDebounce } from '@/hooks/useDebounce'
import { useAccess } from '@/features/access'
import { LabOrderSheet } from '../components/LabOrderSheet'
import {
  ORDER_STATUS_OPTIONS,
  OrderStatusBadge,
} from '../components/order-badges'
import { useLabOrders } from '../hooks/useLabOrders'
import type { LabOrderRow } from '../types'

const ALL = 'all'
const fmtDate = (iso: string | null) => formatInClinic(iso, 'd MMM')

/** The clinic's lab orders (lab ERD §14) — drafts, in progress and done. */
export function LabOrdersPage() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(ALL)
  const [labId, setLabId] = useState(ALL)
  const [doctorId, setDoctorId] = useState(ALL)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [creating, setCreating] = useState(false)
  const canOrder = useAccess().can('lab.orders.create')
  const query = useDebounce(search, 300).trim()

  const params = {
    page,
    limit,
    search: query || undefined,
    status: status === ALL ? undefined : status,
    labId: labId === ALL ? undefined : labId,
    doctorId: doctorId === ALL ? undefined : doctorId,
    from: from || undefined,
    to: to || undefined,
  }
  const { data, isLoading, isError, refetch, isFetching } = useLabOrders(params)
  const { data: doctors = [] } = useDoctors()
  const services = useClinicServices({ page: 1, limit: 100 })
  const labs = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of services.data?.data ?? []) m.set(s.lab.id, s.lab.name)
    return [...m]
  }, [services.data])

  const activeFilters =
    (query ? 1 : 0) +
    (status !== ALL ? 1 : 0) +
    (labId !== ALL ? 1 : 0) +
    (doctorId !== ALL ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setStatus(ALL)
    setLabId(ALL)
    setDoctorId(ALL)
    setFrom('')
    setTo('')
    setPage(1)
  }
  const open = (o: { id: string }) =>
    void navigate({ to: '/lab-orders/$orderId', params: { orderId: o.id } })

  const columns = useMemo<ColumnDef<LabOrderRow, unknown>[]>(
    () => [
      {
        id: 'order',
        header: 'Order',
        accessorFn: (o) => o.orderNo ?? '',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {row.original.orderNo ?? 'Draft'}
            </p>
            <p className="text-xs text-text-3">
              {row.original.itemCount} item
              {row.original.itemCount === 1 ? '' : 's'}
              {row.original.priority === 'urgent' ? ' · Urgent' : ''}
            </p>
          </div>
        ),
      },
      {
        id: 'patient',
        header: 'Patient',
        accessorFn: (o) => o.patient.fullName,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.patient.fullName}</p>
            <p className="text-xs text-text-3">
              {row.original.patient.patientNumber}
            </p>
          </div>
        ),
      },
      { id: 'lab', header: 'Lab', accessorFn: (o) => o.lab.name },
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
        header: 'Due back',
        accessorFn: (o) => o.labExpectedOn ?? '',
        cell: ({ row }) => (
          <span className="text-sm">{row.original.labExpectedOn ?? '—'}</span>
        ),
      },
      {
        id: 'cost',
        header: 'Lab cost',
        accessorFn: (o) => o.labCostMinor ?? -1,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.labCostMinor === null
              ? '—'
              : formatMinor(row.original.labCostMinor)}
          </span>
        ),
      },
      {
        id: 'created',
        header: 'Created',
        accessorKey: 'createdAt',
        cell: ({ row }) => (
          <span className="text-sm">{fmtDate(row.original.createdAt)}</span>
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

  const addButton = canOrder ? (
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-4" /> New lab order
    </Button>
  ) : undefined
  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const onPageSize = (size: number) => {
    setLimit(size)
    setPage(1)
  }
  const filterSelect = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: [string, string][],
    allLabel: string,
  ) => (
    <Select
      value={value}
      onValueChange={(v) => {
        onChange(v)
        setPage(1)
      }}
    >
      <SelectTrigger className="h-9 w-full sm:w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <DashboardLayout
      title="Lab orders"
      subtitle="Crowns, bridges, dentures — from draft to delivery."
      actions={addButton}
    >
      <div className="space-y-4">
        <ListToolbar
          search={search}
          onSearch={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search order no. or patient…"
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
            <>
              {filterSelect(
                'Filter by status',
                status,
                setStatus,
                ORDER_STATUS_OPTIONS.map((o) => [o.value, o.label]),
                'All statuses',
              )}
              {filterSelect('Filter by lab', labId, setLabId, labs, 'All labs')}
              {filterSelect(
                'Filter by doctor',
                doctorId,
                setDoctorId,
                doctors.map((d) => [d.id, d.fullName]),
                'All doctors',
              )}
              <DatePicker
                value={from || undefined}
                onChange={(v) => {
                  setFrom(v)
                  setPage(1)
                }}
                placeholder="From"
                clearable
                className="h-9 w-full sm:w-36"
              />
              <DatePicker
                value={to || undefined}
                onChange={(v) => {
                  setTo(v)
                  setPage(1)
                }}
                placeholder="To"
                clearable
                className="h-9 w-full sm:w-36"
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
            icon={FlaskConical}
            title="No lab orders yet"
            description="Send your first case to a lab — pick the patient, the lab and the work, and the prices are fixed when you submit."
            action={addButton}
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
                        {o.orderNo ?? 'Draft'}
                      </p>
                      <p className="truncate text-xs text-text-3">
                        {o.patient.fullName} · {o.lab.name}
                      </p>
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2 text-xs text-text-3">
                    <span>
                      {o.itemCount} item{o.itemCount === 1 ? '' : 's'}
                      {o.labExpectedOn ? ` · due ${o.labExpectedOn}` : ''}
                    </span>
                    <span className="tabular-nums">
                      {o.labCostMinor === null
                        ? ''
                        : formatMinor(o.labCostMinor)}
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

      <LabOrderSheet
        open={creating}
        onOpenChange={setCreating}
        order={null}
        onSaved={(o) => {
          if (o.status !== 'draft') open(o)
        }}
      />
    </DashboardLayout>
  )
}
