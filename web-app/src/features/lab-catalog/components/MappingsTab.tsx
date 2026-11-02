import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { Link2, Plus, Star, Unlink } from 'lucide-react'
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
} from '@/components/shared'
import type { ViewMode } from '@/components/shared'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import {
  useClinicLabs,
  useServiceMappings,
  useUpdateMapping,
} from '../hooks/useClinicCatalog'
import { formatMinor } from '../lib/money'
import type { ServiceMapping } from '../types'
import { MappingSheet } from './MappingSheet'

/**
 * Which lab service makes each of the clinic's treatments, and which is the
 * default. Removing a mapping deactivates it (kept for history).
 */
export function MappingsTab() {
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [labId, setLabId] = useState('all')
  const query = useDebounce(search, 300).trim().toLowerCase()
  const { data, isLoading, isError, refetch } = useServiceMappings()
  const labs = useClinicLabs()
  const update = useUpdateMapping()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<ServiceMapping | null>(null)
  const pendingId = update.isPending ? update.variables.mapping.id : null

  const all = data ?? []
  const rows = all.filter(
    (m) =>
      (labId === 'all' || m.labService.lab.id === labId) &&
      (!query ||
        m.clinicTreatment.name.toLowerCase().includes(query) ||
        m.labService.name.toLowerCase().includes(query) ||
        m.labService.lab.name.toLowerCase().includes(query)),
  )
  const activeFilters = (query ? 1 : 0) + (labId !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setLabId('all')
  }

  const actions = (m: ServiceMapping) => (
    <div className="flex justify-end gap-1">
      <TooltipButton
        tooltip={
          m.isDefault
            ? 'Default lab for this treatment'
            : `Make ${m.labService.lab.name} the default`
        }
        variant="ghost"
        size="icon"
        className="size-8"
        disabled={m.isDefault || pendingId === m.id}
        onClick={() => update.mutate({ mapping: m, isDefault: true })}
      >
        <Star
          className={cn('size-4', m.isDefault && 'fill-current text-amber-500')}
        />
      </TooltipButton>
      <TooltipButton
        tooltip="Remove mapping"
        variant="ghost"
        size="icon"
        className="size-8 text-destructive"
        disabled={pendingId === m.id}
        onClick={() => setRemoving(m)}
      >
        <Unlink className="size-4" />
      </TooltipButton>
    </div>
  )

  const columns = useMemo<ColumnDef<ServiceMapping, unknown>[]>(
    () => [
      {
        id: 'treatment',
        header: 'Your treatment',
        accessorFn: (m) => m.clinicTreatment.name,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {row.original.clinicTreatment.name}
            </p>
            <p className="text-xs tabular-nums text-text-3">
              {formatMinor(row.original.clinicTreatment.defaultPriceMinor)}{' '}
              default price
            </p>
          </div>
        ),
      },
      {
        id: 'service',
        header: 'Lab service',
        accessorFn: (m) => m.labService.name,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.labService.name}</p>
            <p className="truncate text-xs text-text-3">
              {row.original.labService.lab.name}
            </p>
          </div>
        ),
      },
      {
        id: 'default',
        header: 'Default',
        accessorKey: 'isDefault',
        cell: ({ row }) =>
          row.original.isDefault ? (
            <Badge className="font-normal">Default</Badge>
          ) : null,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => actions(row.original),
      },
    ],
    [pendingId],
  )

  const addButton = (
    <Button size="sm" onClick={() => setAdding(true)}>
      <Plus className="size-3.5" /> Add mapping
    </Button>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text-3">
          A lab service is billed to the patient as the treatment it is mapped
          to.
        </p>
        {addButton}
      </div>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search treatments, services or labs…"
        activeFilters={activeFilters}
        onClear={clearFilters}
        resultLabel={`${rows.length} mapping${rows.length === 1 ? '' : 's'}`}
        viewMode={viewMode}
        onViewMode={setViewMode}
        filters={
          <Select value={labId} onValueChange={setLabId}>
            <SelectTrigger
              className="h-9 w-44"
              aria-label="Filter mappings by lab"
            >
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
        }
      />

      {isLoading ? (
        <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No mappings yet"
          description="Map each lab service to the treatment you bill patients for, so lab orders carry the right patient price."
          action={addButton}
        />
      ) : rows.length === 0 ? (
        <NoResultsState
          message="No mappings match your filters."
          onClear={clearFilters}
        />
      ) : viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={rows}
          pageSizeOptions={[10, 20, 50]}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((m) => (
            <article
              key={m.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">
                    {m.clinicTreatment.name}
                  </h3>
                  <p className="text-xs tabular-nums text-text-3">
                    {formatMinor(m.clinicTreatment.defaultPriceMinor)}
                  </p>
                </div>
                {m.isDefault && <Badge className="font-normal">Default</Badge>}
              </div>
              <p className="text-sm">
                {m.labService.name}{' '}
                <span className="text-text-3">· {m.labService.lab.name}</span>
              </p>
              <div className="mt-auto border-t border-border/60 pt-2">
                {actions(m)}
              </div>
            </article>
          ))}
        </div>
      )}

      <MappingSheet open={adding} onOpenChange={setAdding} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this mapping?"
        description={
          removing &&
          `${removing.labService.name} (${removing.labService.lab.name}) will no longer be billed as ${removing.clinicTreatment.name}. Orders already placed keep their prices.`
        }
        confirmLabel="Remove mapping"
        destructive
        isLoading={update.isPending}
        onConfirm={() =>
          removing &&
          update.mutate(
            { mapping: removing, isActive: false },
            { onSuccess: () => setRemoving(null) },
          )
        }
      />
    </div>
  )
}
