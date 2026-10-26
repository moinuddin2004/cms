import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { BookmarkPlus, Pencil, Plus, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { useAccess } from '@/features/access'
import { ActiveSwitch } from '../components/ActiveSwitch'
import { OrderTemplateSheet } from '../components/OrderTemplateSheet'
import {
  useClinicLabs,
  useOrderTemplates,
  useSetTemplateActive,
} from '../hooks/useClinicCatalog'
import type { OrderTemplate, TemplateScope } from '../types'

const SCOPE_LABEL: Record<TemplateScope, string> = {
  all: 'Mine & shared',
  mine: 'Only mine',
  shared: 'Shared',
}

const itemsLabel = (t: OrderTemplate) => {
  const n = t.body.items.reduce((sum, i) => sum + i.quantity, 0)
  return `${t.body.items.length} service${t.body.items.length === 1 ? '' : 's'} · ${n} unit${n === 1 ? '' : 's'}`
}

/** Saved lab orders — a doctor's own plus the clinic's shared ones. */
export function OrderTemplatesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<TemplateScope>('all')
  const [labId, setLabId] = useState('all')
  const [showArchived, setShowArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const query = useDebounce(search, 300).trim()
  const canShare = useAccess().can('lab.templates.share')

  const params = {
    page,
    limit,
    search: query || undefined,
    scope,
    labId: labId === 'all' ? undefined : labId,
    includeInactive: showArchived || undefined,
  }
  const { data, isLoading, isError, refetch, isFetching } =
    useOrderTemplates(params)
  const labs = useClinicLabs()
  const setActive = useSetTemplateActive()
  const pendingId = setActive.isPending ? setActive.variables.template.id : null
  const [sheet, setSheet] = useState<{ template: OrderTemplate | null } | null>(
    null,
  )

  const activeFilters =
    (query ? 1 : 0) +
    (scope !== 'all' ? 1 : 0) +
    (labId !== 'all' ? 1 : 0) +
    (showArchived ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setScope('all')
    setLabId('all')
    setShowArchived(false)
    setPage(1)
  }

  const controls = (t: OrderTemplate) =>
    t.canEdit ? (
      <div
        className="flex items-center justify-end gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <ActiveSwitch
          checked={t.isActive}
          disabled={pendingId === t.id}
          label={`${t.name} is in use`}
          onTooltip="In use — click to archive"
          offTooltip="Archived — click to restore"
          onChange={(isActive) => setActive.mutate({ template: t, isActive })}
        />
        <TooltipButton
          tooltip={`Edit ${t.name}`}
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => setSheet({ template: t })}
        >
          <Pencil className="size-4" />
        </TooltipButton>
      </div>
    ) : null

  const columns = useMemo<ColumnDef<OrderTemplate, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Template',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {row.original.name}
            </p>
            <p className="truncate text-xs text-text-3">
              {itemsLabel(row.original)}
            </p>
          </div>
        ),
      },
      {
        id: 'lab',
        header: 'Lab',
        accessorFn: (t) => t.lab?.name ?? '',
        cell: ({ row }) => (
          <span className="text-sm">{row.original.lab?.name ?? '—'}</span>
        ),
      },
      {
        id: 'owner',
        header: 'Owner',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.shared ? (
            <Badge variant="outline" className="font-normal">
              <Users className="size-3" /> Shared
            </Badge>
          ) : (
            <span className="text-sm text-text-2">
              {row.original.owner?.name ?? 'You'}
            </span>
          ),
      },
      {
        id: 'uses',
        header: 'Used',
        accessorKey: 'useCount',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original.useCount}×</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => controls(row.original),
      },
    ],
    [pendingId],
  )

  const addButton = (
    <Button onClick={() => setSheet({ template: null })}>
      <Plus className="size-4" /> New template
    </Button>
  )
  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const onPageSize = (size: number) => {
    setLimit(size)
    setPage(1)
  }

  return (
    <DashboardLayout
      title="Order templates"
      subtitle="Your usual lab orders, ready to send in seconds."
      actions={addButton}
    >
      <div className="space-y-4">
        <ListToolbar
          search={search}
          onSearch={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search templates…"
          activeFilters={activeFilters}
          onClear={clearFilters}
          resultLabel={
            isFetching && !isLoading
              ? 'Updating…'
              : `${total} template${total === 1 ? '' : 's'}`
          }
          viewMode={viewMode}
          onViewMode={setViewMode}
          filters={
            <>
              <Select
                value={scope}
                onValueChange={(v) => {
                  setScope(v as TemplateScope)
                  setPage(1)
                }}
              >
                <SelectTrigger
                  className="h-9 w-40"
                  aria-label="Filter by owner"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCOPE_LABEL) as TemplateScope[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SCOPE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={labId}
                onValueChange={(v) => {
                  setLabId(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 w-44" aria-label="Filter by lab">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All labs</SelectItem>
                  {(labs.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={showArchived ? 'all' : 'active'}
                onValueChange={(v) => {
                  setShowArchived(v === 'all')
                  setPage(1)
                }}
              >
                <SelectTrigger
                  className="h-9 w-40"
                  aria-label="Show archived templates"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">In use</SelectItem>
                  <SelectItem value="all">Include archived</SelectItem>
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
            icon={BookmarkPlus}
            title="No templates yet"
            description="Save the lab orders you send most — a crown, a bridge — and start each new order from one."
            action={addButton}
          />
        ) : total === 0 ? (
          <NoResultsState
            message="No templates match your filters."
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
              onPageSizeChange: onPageSize,
              pageSizeOptions: [10, 20, 50, 100],
            }}
            getRowClassName={(t) => (t.isActive ? undefined : 'opacity-60')}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((t) => (
                <article
                  key={t.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm data-[archived=true]:opacity-60"
                  data-archived={!t.isActive}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">
                        {t.name}
                      </h2>
                      <p className="truncate text-xs text-text-3">
                        {t.lab?.name ?? '—'} · {itemsLabel(t)}
                      </p>
                    </div>
                    {t.shared && (
                      <Badge variant="outline" className="font-normal">
                        <Users className="size-3" /> Shared
                      </Badge>
                    )}
                  </div>
                  {t.body.notes && (
                    <p className="line-clamp-2 text-xs text-text-2">
                      {t.body.notes}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2 text-xs text-text-3">
                    <span>Used {t.useCount}×</span>
                    {controls(t)}
                  </div>
                </article>
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

      <OrderTemplateSheet
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        template={sheet?.template ?? null}
        canShare={canShare}
      />
    </DashboardLayout>
  )
}
