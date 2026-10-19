import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Building2 } from 'lucide-react'
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
} from '@/components/shared'
import type { ViewMode } from '@/components/shared'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { useDebounce } from '@/hooks/useDebounce'
import { LabPortalLayout } from '../components/LabPortalLayout'
import { PortalClinicActions } from '../components/PortalClinicActions'
import type { ClinicActionHandlers } from '../components/PortalClinicActions'
import {
  PortalClinicCard,
  PortalLinkBadge,
} from '../components/PortalClinicCard'
import { SuspendClinicDialog } from '../components/SuspendClinicDialog'
import {
  useActiveLab,
  usePortalClinicTransition,
  usePortalClinics,
} from '../hooks/useLabPortal'
import { PORTAL_LINK_STATUS_LABEL } from '../types'
import type { LabLinkStatus, PortalClinic } from '../types'

type StatusFilter = LabLinkStatus | 'all'

/**
 * The clinics working with this lab. A lab sees each clinic's name, city,
 * link status and payment terms — nothing else of the clinic's data.
 */
export function LabClinicsPage() {
  const { isLabAdmin } = useActiveLab()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const query = useDebounce(search, 300).trim()

  const { data, isLoading, isError, refetch, isFetching } = usePortalClinics({
    search: query || undefined,
    status: status === 'all' ? undefined : status,
  })
  const transition = usePortalClinicTransition()
  const [suspending, setSuspending] = useState<PortalClinic | null>(null)
  const pendingId = transition.isPending ? transition.variables.link.id : null

  const activeFilters = (query ? 1 : 0) + (status !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setStatus('all')
  }

  const handlers: ClinicActionHandlers = useMemo(
    () => ({
      onSuspend: setSuspending,
      onTransition: (link, action) => transition.mutate({ link, action }),
      pendingId,
      canManage: isLabAdmin,
    }),
    [pendingId, isLabAdmin],
  )

  const columns = useMemo<ColumnDef<PortalClinic, unknown>[]>(
    () => [
      {
        id: 'clinic',
        header: 'Clinic',
        accessorFn: (c) => c.clinic.name,
        cell: ({ row }) => (
          <p className="truncate text-sm font-semibold">
            {row.original.clinic.name}
          </p>
        ),
      },
      {
        id: 'city',
        header: 'City',
        accessorFn: (c) => c.clinic.city ?? '',
        cell: ({ row }) => (
          <span className="text-sm text-text-2">
            {row.original.clinic.city ?? '—'}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => <PortalLinkBadge status={row.original.status} />,
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
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <PortalClinicActions link={row.original} {...handlers} />
        ),
      },
    ],
    [handlers],
  )

  const rows = data ?? []

  return (
    <LabPortalLayout
      title="Clinics"
      subtitle="Clinics that send work to your lab. Accept new invitations here."
    >
      <div className="space-y-4">
        <ListToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search by clinic name…"
          activeFilters={activeFilters}
          onClear={clearFilters}
          resultLabel={
            isFetching && !isLoading
              ? 'Updating…'
              : `${rows.length} clinic${rows.length === 1 ? '' : 's'}`
          }
          viewMode={viewMode}
          onViewMode={setViewMode}
          filters={
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as StatusFilter)}
            >
              <SelectTrigger className="h-9 w-48" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(PORTAL_LINK_STATUS_LABEL) as LabLinkStatus[]).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {PORTAL_LINK_STATUS_LABEL[s]}
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
        ) : rows.length === 0 && activeFilters === 0 ? (
          <EmptyState
            icon={Building2}
            title="No clinics yet"
            description="When a clinic adds your lab to its lab list, the invitation shows up here for you to accept."
          />
        ) : rows.length === 0 ? (
          <NoResultsState
            message="No clinics match your filters."
            onClear={clearFilters}
          />
        ) : viewMode === 'table' ? (
          <DataTable columns={columns} data={rows} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((link) => (
              <PortalClinicCard key={link.id} link={link} {...handlers} />
            ))}
          </div>
        )}
      </div>

      <SuspendClinicDialog
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
    </LabPortalLayout>
  )
}
