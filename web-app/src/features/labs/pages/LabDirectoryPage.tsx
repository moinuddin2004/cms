import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { useNavigate } from '@tanstack/react-router'
import { FlaskConical, Pencil, Plus } from 'lucide-react'
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
import { ListToolbar } from '@/components/shared/ListToolbar'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { useDebounce } from '@/hooks/useDebounce'
import { LabCard } from '../components/LabCard'
import { LabSheet } from '../components/LabSheet'
import { LabStatusSwitch } from '../components/LabStatusSwitch'
import { LabStatusBadge, LabTypeBadge } from '../components/lab-badges'
import { useLabs } from '../hooks/useLabDirectory'
import { LAB_TYPE_LABEL } from '../types'
import type { Lab, LabStatus, LabType } from '../types'

/** Platform lab directory (super admin): every lab clinics can work with. */
export function LabDirectoryPage() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<LabStatus | 'all'>('all')
  const [labType, setLabType] = useState<LabType | 'all'>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const query = useDebounce(search, 300).trim()

  const { data, isLoading, isError, refetch, isFetching } = useLabs({
    page,
    limit,
    search: query || undefined,
    status: status === 'all' ? undefined : status,
    labType: labType === 'all' ? undefined : labType,
  })

  const [sheet, setSheet] = useState<{ lab: Lab | null } | null>(null)
  const open = (lab: Lab) =>
    void navigate({ to: '/lab-directory/$labId', params: { labId: lab.id } })

  const activeFilters =
    (query ? 1 : 0) + (status !== 'all' ? 1 : 0) + (labType !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setLabType('all')
    setPage(1)
  }

  const columns = useMemo<ColumnDef<Lab, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Lab',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {row.original.name}
            </p>
            <p className="truncate text-xs text-text-3">
              {row.original.ownerOrganization?.name ?? row.original.city ?? '—'}
            </p>
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        accessorKey: 'labType',
        cell: ({ row }) => <LabTypeBadge type={row.original.labType} />,
      },
      {
        id: 'contact',
        header: 'Contact',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="min-w-0 text-sm">
            <p className="truncate">
              {row.original.phone ?? row.original.whatsappPhone ?? '—'}
            </p>
            {row.original.email && (
              <p className="truncate text-xs text-text-3">
                {row.original.email}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'clinics',
        header: 'Clinics',
        accessorKey: 'activeLinkCount',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.activeLinkCount}
          </span>
        ),
      },
      {
        id: 'staff',
        header: 'Staff',
        accessorKey: 'memberCount',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.memberCount}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <LabStatusSwitch lab={row.original} />
            <LabStatusBadge status={row.original.status} />
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <TooltipButton
              tooltip={`Edit ${row.original.name}`}
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={(e) => {
                e.stopPropagation()
                setSheet({ lab: row.original })
              }}
            >
              <Pencil className="size-4" />
            </TooltipButton>
          </div>
        ),
      },
    ],
    [],
  )

  const addButton = (
    <Button onClick={() => setSheet({ lab: null })}>
      <Plus className="size-4" /> Add lab
    </Button>
  )

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const onPageSizeChange = (size: number) => {
    setLimit(size)
    setPage(1)
  }

  return (
    <DashboardLayout
      title="Lab Directory"
      subtitle="Dental labs on the platform. Clinics add labs from this list."
      actions={addButton}
    >
      <div className="space-y-4">
        <ListToolbar
          search={search}
          onSearch={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search by name, city, phone or email…"
          activeFilters={activeFilters}
          onClear={clearFilters}
          resultLabel={
            isFetching && !isLoading
              ? 'Updating…'
              : `${total} lab${total === 1 ? '' : 's'}`
          }
          viewMode={viewMode}
          onViewMode={setViewMode}
          filters={
            <>
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as LabStatus | 'all')
                  setPage(1)
                }}
              >
                <SelectTrigger
                  className="h-9 w-full sm:w-36"
                  aria-label="Filter by status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={labType}
                onValueChange={(v) => {
                  setLabType(v as LabType | 'all')
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-36" aria-label="Filter by type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {(Object.keys(LAB_TYPE_LABEL) as LabType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {LAB_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            title="No labs on the platform yet"
            description="Add the dental labs your clinics work with. One lab can serve many clinics."
            action={addButton}
          />
        ) : total === 0 ? (
          <NoResultsState
            message="No labs match your filters."
            onClear={clearFilters}
          />
        ) : viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={rows}
            pagination={false}
            serverPagination={{
              page,
              pageSize: limit,
              total,
              onPageChange: setPage,
              onPageSizeChange,
              pageSizeOptions: [10, 20, 50, 100],
            }}
            onRowClick={open}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((lab) => (
                <LabCard
                  key={lab.id}
                  lab={lab}
                  onOpen={open}
                  onEdit={(l) => setSheet({ lab: l })}
                />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(total / limit))}
              limit={limit}
              total={total}
              onPageChange={setPage}
              onLimitChange={onPageSizeChange}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        )}
      </div>

      <LabSheet
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        lab={sheet?.lab ?? null}
      />
    </DashboardLayout>
  )
}
