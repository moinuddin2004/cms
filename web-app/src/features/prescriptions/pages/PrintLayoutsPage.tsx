import { useMemo, useState } from 'react'
import { Can } from '@/features/access/components/Can'
import type { ColumnDef } from '@tanstack/react-table'
import { LayoutTemplate, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import type { PrescriptionTemplate } from '../types'
import {
  useDeactivatePrescriptionTemplate,
  usePrescriptionTemplates,
} from '../hooks/usePrescriptionTemplates'
import { LibraryShell } from '../components/library/LibraryShell'
import { LibraryToolbar } from '../components/library/LibraryToolbar'
import {
  CardPagination,
  LibraryRowActions,
  useLocalPaging,
} from '../components/library/library-helpers'
import { LayoutSheet } from '../components/library/LayoutSheet'

const accent = (l: PrescriptionTemplate) =>
  (l.styling.primaryColor as string | undefined) ?? '#0d9488'

const clinic = (l: PrescriptionTemplate) =>
  (l.header.clinicName as string | undefined) || 'No clinic name set'

function Swatch({ layout }: { layout: PrescriptionTemplate }) {
  return (
    <span
      className="inline-block size-3.5 shrink-0 rounded-full border border-border"
      style={{ backgroundColor: accent(layout) }}
      aria-hidden="true"
    />
  )
}

/** Print layouts: letterhead, footer and paper for printed prescriptions. */
export function PrintLayoutsPage() {
  const {
    data: layouts = [],
    isLoading,
    isError,
    refetch,
  } = usePrescriptionTemplates()
  const deactivate = useDeactivatePrescriptionTemplate()

  const [viewMode, setViewMode] = useState<ViewMode>('card')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<PrescriptionTemplate | null>(null)
  const [deactivating, setDeactivating] = useState<PrescriptionTemplate | null>(
    null,
  )
  const query = useDebounce(search, 300).trim().toLowerCase()

  const filtered = useMemo(
    () =>
      layouts.filter(
        (l) =>
          !query ||
          l.name.toLowerCase().includes(query) ||
          clinic(l).toLowerCase().includes(query),
      ),
    [layouts, query],
  )
  const { slice, pagination, resetPage } = useLocalPaging(filtered)

  const activeFilters = query ? 1 : 0
  const clearFilters = () => {
    setSearch('')
    resetPage()
  }

  const columns = useMemo<ColumnDef<PrescriptionTemplate, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Layout',
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Swatch layout={row.original} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {row.original.name}
              </p>
              <p className="truncate text-xs text-text-3">
                {clinic(row.original)}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'paper',
        header: 'Paper',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.pageSize} · {row.original.orientation.toLowerCase()}
          </span>
        ),
      },
      {
        id: 'default',
        header: 'Default',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.isDefault ? (
            <Badge className="border-emerald/30 bg-emerald-soft text-emerald">
              Default
            </Badge>
          ) : (
            <span className="text-text-3">—</span>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <LibraryRowActions
            noun="layout"
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
        <Plus className="size-3.5" /> New layout
      </Button>
    </Can>
  )

  return (
    <LibraryShell
      subtitle="Letterhead, footer and paper size for printed prescriptions."
      actions={newButton}
    >
      <LibraryToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v)
          resetPage()
        }}
        placeholder="Search layouts…"
        activeFilters={activeFilters}
        onClear={clearFilters}
        resultLabel={`${filtered.length} layout${filtered.length === 1 ? '' : 's'}`}
        viewMode={viewMode}
        onViewMode={setViewMode}
      />

      {isLoading ? (
        <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : layouts.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="No print layouts yet"
          description="Create one so prescriptions print with your clinic name, address and colours."
          action={newButton}
        />
      ) : filtered.length === 0 ? (
        <NoResultsState
          message="No layouts match your search."
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
            {slice.map((l) => (
              <article
                key={l.id}
                className="flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm"
              >
                <div
                  className="h-1.5"
                  style={{ backgroundColor: accent(l) }}
                  aria-hidden="true"
                />
                <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">
                        {l.name}
                      </h2>
                      <p className="truncate text-xs text-text-3">
                        {clinic(l)}
                      </p>
                    </div>
                    {l.isDefault && (
                      <Badge className="shrink-0 border-emerald/30 bg-emerald-soft text-emerald">
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="flex-1 text-xs text-text-2">
                    {l.pageSize} · {l.orientation.toLowerCase()}
                    {(l.footer.address as string | undefined) &&
                      ` · ${l.footer.address as string}`}
                  </p>
                  <div className="border-t border-border/60 pt-2">
                    <LibraryRowActions
                      noun="layout"
                      onEdit={() => setEditing(l)}
                      onDeactivate={() => setDeactivating(l)}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
          <CardPagination pagination={pagination} />
        </div>
      )}

      <LayoutSheet
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setEditing(null)
          }
        }}
        layout={editing}
      />

      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title="Deactivate this layout?"
        description={
          <>
            <strong>{deactivating?.name}</strong> will no longer be offered for
            new prescriptions. Prescriptions already printed are not changed.
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
