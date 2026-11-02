import { useMemo, useState } from 'react'
import { Can } from '@/features/access/components/Can'
import type { ColumnDef } from '@/components/shared/table-features'
import { ClipboardList, Plus } from 'lucide-react'
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
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  NoResultsState,
} from '@/components/shared'
import type { ViewMode } from '@/components/shared'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { useDebounce } from '@/hooks/useDebounce'
import type { PrescriptionPreset } from '../types'
import {
  PRESET_CATEGORY_OPTIONS,
  presetCategoryLabel,
  toPresetCategory,
} from '../types'
import {
  useDeactivatePrescriptionPreset,
  usePrescriptionPresets,
} from '../hooks/usePrescriptionPresets'
import { LibraryShell } from '../components/library/LibraryShell'
import { LibraryToolbar } from '../components/library/LibraryToolbar'
import {
  CardPagination,
  LibraryRowActions,
  useLocalPaging,
} from '../components/library/library-helpers'
import { PresetSheet } from '../components/library/PresetSheet'

/** First few medicine names, "+N more" after that. */
function MedicineSummary({ preset }: { preset: PrescriptionPreset }) {
  const names = preset.medicines.map((m) => m.medicineName)
  const shown = names.slice(0, 3)
  const more = names.length - shown.length
  return (
    <span className="text-sm text-text-2">
      {shown.join(', ')}
      {more > 0 && <span className="text-text-3"> +{more} more</span>}
    </span>
  )
}

/** Prescription presets: ready-made medicine sets for common conditions. */
export function PresetsPage() {
  const {
    data: presets = [],
    isLoading,
    isError,
    refetch,
  } = usePrescriptionPresets()
  const deactivate = useDeactivatePrescriptionPreset()

  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PrescriptionPreset | null>(null)
  const [deactivating, setDeactivating] =
    useState<PrescriptionPreset | null>(null)
  const query = useDebounce(search, 300).trim().toLowerCase()

  const filtered = useMemo(
    () =>
      presets.filter(
        (p) =>
          (category === 'all' || toPresetCategory(p.category) === category) &&
          (!query ||
            p.name.toLowerCase().includes(query) ||
            p.medicines.some((m) =>
              m.medicineName.toLowerCase().includes(query),
            )),
      ),
    [presets, category, query],
  )
  const { slice, pagination, resetPage } = useLocalPaging(filtered)

  const activeFilters = (query ? 1 : 0) + (category !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setCategory('all')
    resetPage()
  }

  const columns = useMemo<ColumnDef<PrescriptionPreset, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Preset',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {row.original.name}
            </p>
            {row.original.description && (
              <p className="truncate text-xs text-text-3">
                {row.original.description}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'category',
        header: 'Category',
        accessorKey: 'category',
        cell: ({ row }) => (
          <Badge variant="outline">
            {presetCategoryLabel(row.original.category)}
          </Badge>
        ),
      },
      {
        id: 'medicines',
        header: 'Medicines',
        enableSorting: false,
        cell: ({ row }) => <MedicineSummary preset={row.original} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <LibraryRowActions
            noun="preset"
            onEdit={() => setEditing(row.original)}
            onDeactivate={() => setDeactivating(row.original)}
          />
        ),
      },
    ],
    [],
  )

  // Writing the library is `prescriptions.library.manage`; reading is open.
  const newButton = (
    <Can perm="prescriptions.library.manage">
      <Button size="sm" onClick={() => setCreating(true)}>
        <Plus className="size-3.5" /> New preset
      </Button>
    </Can>
  )

  return (
    <LibraryShell
      subtitle="Ready-made medicine sets. One tap adds a whole set to a prescription."
      actions={newButton}
    >
      <LibraryToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v)
          resetPage()
        }}
        placeholder="Search presets or medicines…"
        activeFilters={activeFilters}
        onClear={clearFilters}
        resultLabel={`${filtered.length} preset${filtered.length === 1 ? '' : 's'}`}
        viewMode={viewMode}
        onViewMode={setViewMode}
        filters={
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v)
              resetPage()
            }}
          >
            <SelectTrigger className="h-9 w-56" aria-label="Filter by category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {PRESET_CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
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
      ) : presets.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No presets yet"
          description="Save the medicines you prescribe again and again — for example “Toothache after extraction” — and add them in one tap."
          action={newButton}
        />
      ) : filtered.length === 0 ? (
        <NoResultsState
          message="No presets match your filters."
          onClear={clearFilters}
        />
      ) : viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={slice}
          pagination={false}
          serverPagination={pagination}
          onRowClick={setEditing}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {slice.map((p) => (
              <article
                key={p.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold">{p.name}</h2>
                  <Badge variant="outline" className="shrink-0">
                    {presetCategoryLabel(p.category)}
                  </Badge>
                </div>
                {p.description && (
                  <p className="text-xs text-text-3">{p.description}</p>
                )}
                <ul className="flex-1 space-y-1 text-sm">
                  {p.medicines.slice(0, 4).map((m) => (
                    <li key={m.id} className="truncate">
                      {m.medicineName}
                      <span className="text-xs text-text-3">
                        {' '}
                        · {m.frequency} · {m.duration}
                      </span>
                    </li>
                  ))}
                  {p.medicines.length > 4 && (
                    <li className="text-xs text-text-3">
                      +{p.medicines.length - 4} more
                    </li>
                  )}
                </ul>
                <div className="flex items-center justify-between border-t border-border/60 pt-2">
                  <span className="text-xs text-text-3">
                    {p.medicines.length} medicine
                    {p.medicines.length === 1 ? '' : 's'}
                  </span>
                  <LibraryRowActions
                    noun="preset"
                    onEdit={() => setEditing(p)}
                    onDeactivate={() => setDeactivating(p)}
                  />
                </div>
              </article>
            ))}
          </div>
          <CardPagination pagination={pagination} />
        </div>
      )}

      <PresetSheet
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setEditing(null)
          }
        }}
        preset={editing}
      />

      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title="Deactivate this preset?"
        description={
          <>
            <strong>{deactivating?.name}</strong> will no longer be offered when
            writing a prescription. Prescriptions already written are not
            changed.
          </>
        }
        confirmLabel="Deactivate"
        destructive
        isLoading={deactivate.isPending}
        onConfirm={() =>
          deactivating &&
          deactivate.mutate(deactivating.id, {
            onSuccess: () => setDeactivating(null),
          })
        }
      />
    </LibraryShell>
  )
}
