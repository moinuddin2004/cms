import { useMemo, useState } from 'react'
import { Can } from '@/features/access/components/Can'
import type { ColumnDef } from '@tanstack/react-table'
import { Pill, Plus, Sparkles } from 'lucide-react'
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
import { MEDICINE_TYPE_OPTIONS } from '../types'
import type { MedicineDirectoryItem } from '../types'
import {
  useDeactivateMedicine,
  useMedicines,
  useSeedCommonMedicines,
} from '../hooks/useMedicineDirectory'
import { LibraryShell } from '../components/library/LibraryShell'
import { LibraryToolbar } from '../components/library/LibraryToolbar'
import {
  CardPagination,
  LibraryRowActions,
  useLocalPaging,
} from '../components/library/library-helpers'
import { MedicineSheet } from '../components/library/MedicineSheet'

const typeLabel = (type: string) =>
  MEDICINE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type

const defaultsLine = (m: MedicineDirectoryItem) =>
  [m.defaultDosage, m.defaultFrequency, m.defaultDuration]
    .filter(Boolean)
    .join(' · ')

/** The medicine catalogue behind the prescription builder's search. */
export function MedicinesPage() {
  const { data: medicines = [], isLoading, isError, refetch } = useMedicines()
  const seed = useSeedCommonMedicines()
  const deactivate = useDeactivateMedicine()

  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<MedicineDirectoryItem | null>(null)
  const [deactivating, setDeactivating] =
    useState<MedicineDirectoryItem | null>(null)
  const query = useDebounce(search, 300).trim().toLowerCase()

  const filtered = useMemo(
    () =>
      medicines.filter(
        (m) =>
          (type === 'all' || m.type === type) &&
          (!query ||
            m.name.toLowerCase().includes(query) ||
            (m.genericName?.toLowerCase().includes(query) ?? false)),
      ),
    [medicines, type, query],
  )
  const { slice, pagination, resetPage } = useLocalPaging(filtered)

  const activeFilters = (query ? 1 : 0) + (type !== 'all' ? 1 : 0)
  const clearFilters = () => {
    setSearch('')
    setType('all')
    resetPage()
  }

  const columns = useMemo<ColumnDef<MedicineDirectoryItem, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Medicine',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {row.original.name}
            </p>
            {row.original.genericName && (
              <p className="truncate text-xs text-text-3">
                {row.original.genericName}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        accessorKey: 'type',
        cell: ({ row }) => (
          <Badge variant="outline">{typeLabel(row.original.type)}</Badge>
        ),
      },
      {
        id: 'strength',
        header: 'Strength',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm">{row.original.strength ?? '—'}</span>
        ),
      },
      {
        id: 'defaults',
        header: 'Usual prescription',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-text-2">
            {defaultsLine(row.original) || '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <LibraryRowActions
            noun="medicine"
            onEdit={() => setEditing(row.original)}
            onDeactivate={() => setDeactivating(row.original)}
          />
        ),
      },
    ],
    [],
  )

  // Writing the library is `prescriptions.library.manage`; reading is open.
  const addButton = (
    <Can perm="prescriptions.library.manage">
      <Button size="sm" onClick={() => setCreating(true)}>
        <Plus className="size-3.5" /> Add medicine
      </Button>
    </Can>
  )

  return (
    <LibraryShell
      subtitle="The drug catalogue doctors search while writing a prescription."
      actions={addButton}
    >
      <LibraryToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v)
          resetPage()
        }}
        placeholder="Search by brand or generic name…"
        activeFilters={activeFilters}
        onClear={clearFilters}
        resultLabel={`${filtered.length} medicine${filtered.length === 1 ? '' : 's'}`}
        viewMode={viewMode}
        onViewMode={setViewMode}
        filters={
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v)
              resetPage()
            }}
          >
            <SelectTrigger className="h-9 w-40" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {MEDICINE_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
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
      ) : medicines.length === 0 ? (
        <EmptyState
          icon={Pill}
          title="No medicines yet"
          description="Start with a ready-made list of common medicines, or add your own one by one."
          action={
            <div className="flex gap-2">
              <Can perm="prescriptions.library.manage">
                <Button
                  variant="outline"
                  disabled={seed.isPending}
                  onClick={() => seed.mutate()}
                >
                  <Sparkles className="size-4" /> Add common medicines
                </Button>
              </Can>
              {addButton}
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <NoResultsState
          message="No medicines match your filters."
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
            {slice.map((m) => (
              <article
                key={m.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{m.name}</h2>
                    {m.genericName && (
                      <p className="truncate text-xs text-text-3">
                        {m.genericName}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">{typeLabel(m.type)}</Badge>
                </div>
                <p className="text-xs text-text-2">
                  {[m.strength, defaultsLine(m)].filter(Boolean).join(' · ') ||
                    'No defaults set'}
                </p>
                <div className="mt-auto border-t border-border/60 pt-2">
                  <LibraryRowActions
                    noun="medicine"
                    onEdit={() => setEditing(m)}
                    onDeactivate={() => setDeactivating(m)}
                  />
                </div>
              </article>
            ))}
          </div>
          <CardPagination pagination={pagination} />
        </div>
      )}

      <MedicineSheet
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setEditing(null)
          }
        }}
        item={editing}
      />

      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title="Deactivate this medicine?"
        description={
          <>
            <strong>{deactivating?.name}</strong> will no longer show up in
            search. Prescriptions that already include it are not changed.
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
