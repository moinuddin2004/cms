import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@/components/shared/table-features'
import { Link2, Package } from 'lucide-react'
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
import { ListToolbar } from '@/components/shared/ListToolbar'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { useDebounce } from '@/hooks/useDebounce'
import {
  useClinicCategories,
  useClinicLabs,
  useClinicServices,
} from '../hooks/useClinicCatalog'
import { formatPaisa } from '../lib/money'
import type { ClinicServiceRow } from '../types'
import { PriceTag, UnitTypeBadge } from './catalog-badges'
import { MappingSheet } from './MappingSheet'

type MappedFilter = 'all' | 'mapped' | 'unmapped'

/** Patient price − lab cost for one unit, when both are known. */
function marginOf(s: ClinicServiceRow): number | null {
  return s.price && s.patientPricePaisa !== null
    ? s.patientPricePaisa - s.price.unitPricePaisa
    : null
}

/**
 * The services of the clinic's labs at the price THIS clinic pays, next to
 * the patient price of the treatment it is billed as.
 */
export function ClinicServicesTab() {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [labId, setLabId] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [mapped, setMapped] = useState<MappedFilter>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const query = useDebounce(search, 300).trim()

  const params = {
    page,
    limit,
    search: query || undefined,
    labId: labId === 'all' ? undefined : labId,
    categoryId: categoryId === 'all' ? undefined : categoryId,
    mapped: mapped === 'all' ? undefined : mapped === 'mapped',
  }
  const { data, isLoading, isError, refetch, isFetching } =
    useClinicServices(params)
  const labs = useClinicLabs()
  const categories = useClinicCategories()
  const [mapping, setMapping] = useState<ClinicServiceRow | null>(null)

  const activeFilters =
    (query ? 1 : 0) +
    (labId !== 'all' ? 1 : 0) +
    (categoryId !== 'all' ? 1 : 0) +
    (mapped !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setLabId('all')
    setCategoryId('all')
    setMapped('all')
    setPage(1)
  }

  const mapButton = (s: ClinicServiceRow) => (
    <TooltipButton
      tooltip={
        s.mapping
          ? `Billed as ${s.mapping.clinicTreatmentName} — change in Treatment mapping`
          : `Bill ${s.name} as one of your treatments`
      }
      variant="ghost"
      size="icon"
      className="size-8"
      disabled={!!s.mapping}
      onClick={(e) => {
        e.stopPropagation()
        setMapping(s)
      }}
    >
      <Link2 className="size-4" />
    </TooltipButton>
  )

  const columns = useMemo<ColumnDef<ClinicServiceRow, unknown>[]>(
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
              {row.original.category.name} · {row.original.code}
            </p>
          </div>
        ),
      },
      {
        id: 'lab',
        header: 'Lab',
        accessorFn: (s) => s.lab.name,
        cell: ({ row }) => (
          <span className="text-sm">{row.original.lab.name}</span>
        ),
      },
      {
        id: 'unit',
        header: 'Charged',
        accessorKey: 'unitType',
        cell: ({ row }) => <UnitTypeBadge unitType={row.original.unitType} />,
      },
      {
        id: 'cost',
        header: 'Lab cost',
        enableSorting: false,
        cell: ({ row }) => <PriceTag price={row.original.price} />,
      },
      {
        id: 'patient',
        header: 'Patient price',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.mapping ? (
            <div className="min-w-0 text-sm">
              <p className="tabular-nums">
                {row.original.patientPricePaisa !== null
                  ? formatPaisa(row.original.patientPricePaisa)
                  : '—'}
              </p>
              <p className="truncate text-xs text-text-3">
                {row.original.mapping.clinicTreatmentName}
              </p>
            </div>
          ) : (
            <span className="text-sm text-text-3">Not mapped</span>
          ),
      },
      {
        id: 'margin',
        header: 'Margin',
        enableSorting: false,
        cell: ({ row }) => {
          const m = marginOf(row.original)
          return (
            <span
              className={
                m !== null && m < 0
                  ? 'text-sm tabular-nums text-destructive'
                  : 'text-sm tabular-nums'
              }
            >
              {m === null ? '—' : formatPaisa(m)}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">{mapButton(row.original)}</div>
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
        placeholder="Search services or labs…"
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
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v)
                setPage(1)
              }}
            >
              <SelectTrigger
                className="h-9 w-40"
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
              value={mapped}
              onValueChange={(v) => {
                setMapped(v as MappedFilter)
                setPage(1)
              }}
            >
              <SelectTrigger
                className="h-9 w-36"
                aria-label="Filter by mapping"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mapped or not</SelectItem>
                <SelectItem value="mapped">Mapped</SelectItem>
                <SelectItem value="unmapped">Not mapped</SelectItem>
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
          title="No lab services yet"
          description="Services appear here once a lab on your list has its catalog set up."
          action={
            <Button variant="outline" asChild>
              <Link to="/labs">Go to your labs</Link>
            </Button>
          }
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
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((s) => {
              const m = marginOf(s)
              return (
                <article
                  key={s.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">
                        {s.name}
                      </h3>
                      <p className="truncate text-xs text-text-3">
                        {s.lab.name} · {s.category.name}
                      </p>
                    </div>
                    {mapButton(s)}
                  </div>
                  <UnitTypeBadge unitType={s.unitType} />
                  <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-border/60 pt-2 text-xs">
                    <div>
                      <dt className="text-text-3">Lab cost</dt>
                      <dd>
                        <PriceTag price={s.price} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-text-3">Patient price</dt>
                      <dd className="text-sm tabular-nums">
                        {s.patientPricePaisa !== null
                          ? formatPaisa(s.patientPricePaisa)
                          : 'Not mapped'}
                      </dd>
                    </div>
                    {m !== null && (
                      <div className="col-span-2 text-text-3">
                        Margin {formatPaisa(m)} per unit
                      </div>
                    )}
                  </dl>
                </article>
              )
            })}
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

      <MappingSheet
        open={!!mapping}
        onOpenChange={(o) => !o && setMapping(null)}
        labServiceId={mapping?.id}
      />
    </div>
  )
}
