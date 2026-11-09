import { useState } from 'react'
import { Can } from '@/features/access/components/Can'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Plus,
  Library,
  FileText,
  CalendarDays,
  PencilLine,
  CheckCircle2,
  X,
} from 'lucide-react'
import {
  PageWrapper,
  ViewToggle,
  EmptyState,
  ErrorState,
  NoResultsState,
  LoadingSkeleton,
  Pagination,
} from '@/components/shared'
import type { ViewMode } from '@/components/shared'
import { cn } from '@/lib/utils'
import {
  usePrescriptions,
  usePrescriptionStats,
  PrescriptionStatus,
} from '@/features/prescriptions'
import { PrescriptionTable } from '../components/PrescriptionTable'
import { PrescriptionCard } from '../components/PrescriptionCard'

type StatusFilter = 'all' | PrescriptionStatus

export function PrescriptionsPage() {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  const { data, isLoading, isError, refetch } = usePrescriptions({
    status: status !== 'all' ? status : undefined,
    page,
    limit,
  })
  const { data: stats } = usePrescriptionStats()

  const prescriptions = data?.data ?? []
  const total = data?.total ?? 0
  const filtersActive = status !== 'all'

  const amended = stats
    ? Math.max(0, stats.total - stats.draft - stats.finalized)
    : undefined

  const filterOptions: {
    value: StatusFilter
    label: string
    count?: number
  }[] = [
    { value: 'all', label: 'All', count: stats?.total },
    { value: PrescriptionStatus.DRAFT, label: 'Drafts', count: stats?.draft },
    {
      value: PrescriptionStatus.FINALIZED,
      label: 'Finalized',
      count: stats?.finalized,
    },
    { value: PrescriptionStatus.AMENDED, label: 'Amended', count: amended },
  ]

  const changeStatus = (value: StatusFilter) => {
    setStatus(value)
    setPage(1)
  }

  const pagination = {
    page,
    pageSize: limit,
    total,
    onPageChange: setPage,
    onPageSizeChange: (l: number) => {
      setLimit(l)
      setPage(1)
    },
    pageSizeOptions: [10, 20, 50, 100],
  }

  return (
    <PageWrapper
      title="Prescriptions"
      subtitle="Create, review, and manage patient prescriptions."
      actions={
        <div className="flex items-center gap-2">
          <ViewToggle value={viewMode} onChange={setViewMode} size="sm" />
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings/prescription-presets">
              <Library className="size-3.5" />
              Library
            </Link>
          </Button>
          <Can perm="prescriptions.create">
            <Button asChild size="sm">
              <Link to={'/prescriptions/new' as any}>
                <Plus className="size-3.5" />
                New Prescription
              </Link>
            </Button>
          </Can>
        </div>
      }
    >
      {/* KPIs — compact strip, same style as Appointments */}
      <div className="grid grid-cols-2 divide-x divide-y rounded-xl border bg-card sm:grid-cols-4 sm:divide-y-0">
        {[
          {
            label: 'Total',
            value: stats?.total,
            icon: FileText,
            color: 'text-primary-text',
            bg: 'bg-primary-soft',
          },
          {
            label: 'This month',
            value: stats?.thisMonth,
            icon: CalendarDays,
            color: 'text-violet',
            bg: 'bg-violet-soft',
          },
          {
            label: 'Drafts',
            value: stats?.draft,
            icon: PencilLine,
            color: 'text-amber',
            bg: 'bg-amber-soft',
          },
          {
            label: 'Finalized',
            value: stats?.finalized,
            icon: CheckCircle2,
            color: 'text-emerald',
            bg: 'bg-emerald-soft',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent/40"
          >
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-lg',
                bg,
              )}
            >
              <Icon className={cn('size-4', color)} />
            </span>
            <div className="min-w-0 leading-none">
              <p className="truncate text-[11px] font-medium text-text-3">
                {label}
              </p>
              <p className="mt-1 text-base font-bold leading-none tabular-nums">
                {value ?? 0}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2">
        <div
          role="tablist"
          aria-label="Filter by status"
          className="inline-flex flex-wrap items-center gap-0.5 rounded-[9px] bg-panel p-[3px]"
        >
          {filterOptions.map((opt) => {
            const active = status === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeStatus(opt.value)}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-[7px] px-3 text-xs font-medium transition-colors',
                  active
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-text-2 hover:text-foreground',
                )}
              >
                {opt.label}
                {typeof opt.count === 'number' && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[10px] font-semibold tabular-nums',
                      active
                        ? 'bg-primary-soft text-primary-text'
                        : 'bg-panel-2 text-text-3',
                    )}
                  >
                    {opt.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {filtersActive && (
          <Button
            variant="ghost"
            size="xs"
            className="text-text-3"
            onClick={() => changeStatus('all')}
          >
            <X className="size-3" />
            Clear filter
          </Button>
        )}

        <span className="ml-auto pr-1 text-xs text-text-3">
          {total} prescription{total === 1 ? '' : 's'}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : prescriptions.length === 0 ? (
        filtersActive ? (
          <NoResultsState
            message="No prescriptions match this status."
            onClear={() => changeStatus('all')}
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="No prescriptions yet"
            description="Write your first prescription — pick a patient, add medicines, and print it on your letterhead."
            action={
              <Can perm="prescriptions.create">
                <Button asChild>
                  <Link to={'/prescriptions/new' as any}>
                    <Plus className="size-4" />
                    New Prescription
                  </Link>
                </Button>
              </Can>
            }
          />
        )
      ) : viewMode === 'table' ? (
        <PrescriptionTable
          prescriptions={prescriptions}
          serverPagination={pagination}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {prescriptions.map((rx) => (
              <PrescriptionCard key={rx.id} prescription={rx} />
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
    </PageWrapper>
  )
}
