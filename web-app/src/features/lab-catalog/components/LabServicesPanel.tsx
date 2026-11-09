import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { MoreHorizontal, Package, Pencil, Plus, Tag, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { TooltipButton } from '@/components/shared/TooltipButton'
import { useDebounce } from '@/hooks/useDebounce'
import {
  useLabServices,
  useServiceCategories,
  useSetServiceActive,
} from '../hooks/usePlatformCatalog'
import type { PlatformServiceRow } from '../types'
import { ActiveSwitch } from './ActiveSwitch'
import { CategoriesSheet } from './CategoriesSheet'
import { LabServiceSheet } from './LabServiceSheet'
import { PriceTag, UnitTypeBadge } from './catalog-badges'
import { ServicePricingSheet } from './ServicePricingSheet'

type StatusFilter = 'all' | 'active' | 'archived'

/**
 * A lab's catalog on the platform lab page: services, their list price and
 * how many clinics have their own rate. Options and price windows open in a
 * side sheet.
 */
export function LabServicesPanel({ labId }: { labId: string }) {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const query = useDebounce(search, 300).trim()

  const params = {
    page,
    limit,
    search: query || undefined,
    categoryId: categoryId === 'all' ? undefined : categoryId,
    isActive: status === 'all' ? undefined : status === 'active',
  }
  const { data, isLoading, isError, refetch, isFetching } = useLabServices(
    labId,
    params,
  )
  const categories = useServiceCategories()
  const setActive = useSetServiceActive(labId)
  const pendingId = setActive.isPending ? setActive.variables.service.id : null

  const [editing, setEditing] = useState<{
    service: PlatformServiceRow | null
  } | null>(null)
  const [pricingId, setPricingId] = useState<string | null>(null)
  const [managingCategories, setManagingCategories] = useState(false)
  const rows = data?.data ?? []
  // Derived from the live list so the sheet shows fresh options after edits.
  const pricing = rows.find((r) => r.id === pricingId) ?? null

  const activeFilters =
    (query ? 1 : 0) +
    (categoryId !== 'all' ? 1 : 0) +
    (status !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setCategoryId('all')
    setStatus('all')
    setPage(1)
  }

  const actions = useMemo(
    () => (s: PlatformServiceRow) => (
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TooltipButton
              tooltip={`Actions for ${s.name}`}
              variant="ghost"
              size="icon"
              className="size-8"
            >
              <MoreHorizontal className="size-4" />
            </TooltipButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditing({ service: s })}>
              <Pencil className="size-4" /> Edit service
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPricingId(s.id)}>
              <Tag className="size-4" /> Options & prices
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    [],
  )

  const activeSwitch = (s: PlatformServiceRow) => (
    <ActiveSwitch
      checked={s.isActive}
      disabled={pendingId === s.id}
      label={`${s.name} is offered`}
      onTooltip="Offered to clinics — click to archive"
      offTooltip="Archived — click to offer again"
      onChange={(isActive) => setActive.mutate({ service: s, isActive })}
    />
  )

  const columns = useMemo<ColumnDef<PlatformServiceRow, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Service',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {row.original.name}
            </p>
            <p className="truncate text-xs text-text-3">
              {row.original.code} · {row.original.category.name}
            </p>
          </div>
        ),
      },
      {
        id: 'unit',
        header: 'Charged',
        accessorKey: 'unitType',
        cell: ({ row }) => <UnitTypeBadge unitType={row.original.unitType} />,
      },
      {
        id: 'price',
        header: 'List price today',
        enableSorting: false,
        cell: ({ row }) => <PriceTag price={row.original.listPrice} />,
      },
      {
        id: 'rates',
        header: 'Clinic rates',
        accessorKey: 'negotiatedPriceCount',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums text-text-2">
            {row.original.negotiatedPriceCount || '—'}
          </span>
        ),
      },
      {
        id: 'days',
        header: 'Turnaround',
        accessorKey: 'defaultTurnaroundDays',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {row.original.defaultTurnaroundDays} days
          </span>
        ),
      },
      {
        id: 'active',
        header: 'Offered',
        enableSorting: false,
        cell: ({ row }) => activeSwitch(row.original),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => actions(row.original),
      },
    ],
    [pendingId, actions],
  )

  const addButton = (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setManagingCategories(true)}
      >
        <Tags className="size-3.5" /> Categories
      </Button>
      <Button size="sm" onClick={() => setEditing({ service: null })}>
        <Plus className="size-3.5" /> Add service
      </Button>
    </div>
  )
  const total = data?.total ?? 0
  const onPageSize = (size: number) => {
    setLimit(size)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text-3">
          What this lab makes and what it charges. Clinics see only their own
          price.
        </p>
        {addButton}
      </div>
      <ListToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v)
          setPage(1)
        }}
        placeholder="Search by name or code…"
        activeFilters={activeFilters}
        onClear={clearFilters}
        resultLabel={
          isFetching && !isLoading
            ? 'Updating…'
            : `${total} service${total === 1 ? '' : 's'}`
        }
        viewMode={viewMode}
        onViewMode={setViewMode}
        filters={
          <>
            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v)
                setPage(1)
              }}
            >
              <SelectTrigger
                className="h-9 w-full sm:w-44"
                aria-label="Filter by category"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(categories.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as StatusFilter)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-9 w-full sm:w-36" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Offered</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
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
          icon={Package}
          title="No services yet"
          description="Add what this lab makes — crowns, bridges, dentures — with its price."
          action={addButton}
        />
      ) : total === 0 ? (
        <NoResultsState
          message="No services match your filters."
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
          onRowClick={(s) => setPricingId(s.id)}
          getRowClassName={(s) => (s.isActive ? undefined : 'opacity-60')}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((s) => (
              <article
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => setPricingId(s.id)}
                onKeyDown={(e) => e.key === 'Enter' && setPricingId(s.id)}
                className="flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30 data-[archived=true]:opacity-60"
                data-archived={!s.isActive}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{s.name}</h3>
                    <p className="truncate text-xs text-text-3">
                      {s.code} · {s.category.name}
                    </p>
                  </div>
                  {actions(s)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <UnitTypeBadge unitType={s.unitType} />
                  <span className="text-xs text-text-3">
                    {s.defaultTurnaroundDays} days
                  </span>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2">
                  <PriceTag price={s.listPrice} />
                  {activeSwitch(s)}
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

      <LabServiceSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        labId={labId}
        service={editing?.service ?? null}
      />
      <ServicePricingSheet
        labId={labId}
        service={pricing}
        onOpenChange={(o) => !o && setPricingId(null)}
      />
      <CategoriesSheet
        open={managingCategories}
        onOpenChange={setManagingCategories}
      />
    </div>
  )
}
