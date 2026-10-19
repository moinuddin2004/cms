import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
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
import { ListToolbar } from '@/components/shared/ListToolbar'
import { useDebounce } from '@/hooks/useDebounce'
import { LabLinkActions } from '../components/LabLinkActions'
import type { LinkActionHandlers } from '../components/LabLinkActions'
import { LabLinkCard } from '../components/LabLinkCard'
import { LabLinkHistorySheet } from '../components/LabLinkHistorySheet'
import { LabLinkSheet } from '../components/LabLinkSheet'
import { SuspendLinkDialog } from '../components/SuspendLinkDialog'
import {
  LabStatusBadge,
  LabTypeBadge,
  LinkStatusBadge,
} from '../components/lab-badges'
import { useLabLinks, useLabLinkTransition } from '../hooks/useLabLinks'
import { LINK_STATUS_LABEL, PATIENT_DATA_LABEL } from '../types'
import type { LabLink, LabLinkStatus } from '../types'

type StatusFilter = LabLinkStatus | 'all'

/** The labs this clinic works with — add, set terms, activate, suspend. */
export function LabLinksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const query = useDebounce(search, 300).trim()

  const params = {
    page,
    limit,
    search: query || undefined,
    status: status === 'all' ? undefined : status,
  }
  const { data, isLoading, isError, refetch, isFetching } = useLabLinks(params)

  const [sheet, setSheet] = useState<{ link: LabLink | null } | null>(null)
  const [historyOf, setHistoryOf] = useState<LabLink | null>(null)
  const [suspending, setSuspending] = useState<LabLink | null>(null)
  const transition = useLabLinkTransition()
  const pendingId = transition.isPending ? transition.variables.link.id : null

  const activeFilters = (query ? 1 : 0) + (status !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setPage(1)
  }

  const handlers: LinkActionHandlers = useMemo(
    () => ({
      onEdit: (link) => setSheet({ link }),
      onHistory: setHistoryOf,
      onSuspend: setSuspending,
      onTransition: (link, action) => transition.mutate({ link, action }),
      pendingId,
    }),
    [pendingId],
  )

  const columns = useMemo<ColumnDef<LabLink, unknown>[]>(
    () => [
      {
        id: 'lab',
        header: 'Lab',
        accessorFn: (l) => l.lab.name,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {row.original.lab.name}
            </p>
            <p className="truncate text-xs text-text-3">
              {row.original.lab.city ?? '—'}
            </p>
          </div>
        ),
      },
      {
        id: 'contact',
        header: 'Contact',
        enableSorting: false,
        cell: ({ row }) => {
          const { phone, whatsappPhone, email } = row.original.lab
          return (
            <div className="min-w-0 text-sm">
              <p className="truncate">{phone ?? whatsappPhone ?? '—'}</p>
              {email && <p className="truncate text-xs text-text-3">{email}</p>}
            </div>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1.5">
            <LinkStatusBadge status={row.original.status} />
            {row.original.lab.labType === 'internal' && (
              <LabTypeBadge type="internal" />
            )}
            {row.original.lab.status === 'suspended' && (
              <LabStatusBadge status="suspended" />
            )}
          </div>
        ),
      },
      {
        id: 'terms',
        header: 'Payment terms',
        accessorKey: 'paymentTermsDays',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.paymentTermsDays} days
          </span>
        ),
      },
      {
        id: 'patientData',
        header: 'Patient details shared',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-text-2">
            {PATIENT_DATA_LABEL[row.original.patientDataLevel]}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => <LabLinkActions link={row.original} {...handlers} />,
      },
    ],
    [handlers],
  )

  const addButton = (
    <Button onClick={() => setSheet({ link: null })}>
      <Plus className="size-4" /> Add lab
    </Button>
  )

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const pagination = {
    page,
    pageSize: limit,
    total,
    onPageChange: setPage,
    onPageSizeChange: (size: number) => {
      setLimit(size)
      setPage(1)
    },
    pageSizeOptions: [10, 20, 50, 100],
  }

  return (
    <DashboardLayout
      title="Labs"
      subtitle="The dental labs your clinic sends work to."
      actions={addButton}
    >
      <div className="space-y-4">
        <ListToolbar
          search={search}
          onSearch={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search by lab, city or phone…"
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
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as StatusFilter)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-9 w-48" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(LINK_STATUS_LABEL) as LabLinkStatus[]).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {LINK_STATUS_LABEL[s]}
                    </SelectItem>
                  ),
                )}
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
            icon={FlaskConical}
            title="No labs yet"
            description="Add the labs you send crowns, bridges and dentures to. You'll pick one of them on every lab order."
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
            serverPagination={pagination}
            onRowClick={(link) => setSheet({ link })}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((link) => (
                <LabLinkCard key={link.id} link={link} {...handlers} />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(total / limit))}
              limit={limit}
              total={total}
              onPageChange={setPage}
              onLimitChange={pagination.onPageSizeChange}
              pageSizeOptions={pagination.pageSizeOptions}
            />
          </div>
        )}
      </div>

      <LabLinkSheet
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        link={sheet?.link ?? null}
      />
      <LabLinkHistorySheet
        link={historyOf}
        onOpenChange={(o) => !o && setHistoryOf(null)}
      />
      <SuspendLinkDialog
        link={suspending}
        onOpenChange={(o) => !o && setSuspending(null)}
        onConfirm={(reason) =>
          transition.mutateAsync({
            link: suspending!,
            action: 'suspend',
            reason,
          })
        }
      />
    </DashboardLayout>
  )
}
