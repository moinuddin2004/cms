import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Layers, Pencil, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  NoResultsState,
  Pagination,
} from '@/components/shared'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ListToolbar } from '@/components/shared/ListToolbar'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { StageTemplateSheet } from '../components/StageTemplateSheet'
import { OwnerFilter, SpecialtyFilter } from '../components/StudioFilters'
import { OwnerBadge } from '../components/studio-badges'
import {
  useSetStageTemplateActive,
  useStageTemplates,
} from '../hooks/useStageTemplates'
import { ALL, useStudioListFilters } from '../hooks/useStudioListFilters'
import { PLATFORM } from '../schemas/studio.schema'
import type { StageTemplate } from '../types'

/** Stage templates (try-in sequences) — Configuration Studio. */
export function StageTemplatesPage() {
  const f = useStudioListFilters()
  const q = useStageTemplates({ specialtyId: f.server.specialtyId })
  const [sheet, setSheet] = useState<{ template: StageTemplate | null } | null>(
    null,
  )

  // The API filters by specialty only; owner is filtered here.
  const byOwner = useMemo(
    () =>
      (q.data ?? []).filter((t) =>
        f.owner === ALL
          ? true
          : f.owner === PLATFORM
            ? !t.organization
            : t.organization?.id === f.owner,
      ),
    [q.data, f.owner],
  )
  const { filtered, pageRows } = f.apply(byOwner)
  const total = filtered.length
  const edit = (t: StageTemplate) => setSheet({ template: t })

  const columns = useMemo<ColumnDef<StageTemplate, unknown>[]>(
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
            <p className="truncate font-mono text-xs text-text-3">
              {row.original.code}
            </p>
          </div>
        ),
      },
      {
        id: 'steps',
        header: 'Steps',
        enableSorting: false,
        cell: ({ row }) => <StepChain template={row.original} />,
      },
      {
        id: 'specialty',
        header: 'Specialty',
        accessorFn: (t) => t.specialty.code,
        cell: ({ row }) => (
          <span className="text-sm">{row.original.specialty.code}</span>
        ),
      },
      {
        id: 'owner',
        header: 'Owner',
        accessorFn: (t) => t.organization?.name ?? '',
        cell: ({ row }) => <OwnerBadge owner={row.original.organization} />,
      },
      {
        id: 'active',
        header: 'Active',
        accessorKey: 'isActive',
        cell: ({ row }) => <ActiveSwitch template={row.original} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <TooltipButton
              tooltip={`Edit ${row.original.code}`}
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={(e) => {
                e.stopPropagation()
                edit(row.original)
              }}
            >
              <Pencil className="size-4" />
            </TooltipButton>
          </div>
        ),
      },
    ],
    [],
  )

  const addButton = (
    <Button onClick={() => setSheet({ template: null })}>
      <Plus className="size-4" /> New stage template
    </Button>
  )

  return (
    <DashboardLayout
      title="Stage templates"
      subtitle="Try-in sequences an item goes through (e.g. metal → bisque → final). Platform admins only."
      actions={addButton}
    >
      <div className="space-y-4">
        <ListToolbar
          search={f.search}
          onSearch={f.setSearch}
          placeholder="Search by code or name…"
          activeFilters={f.activeFilters}
          onClear={f.clear}
          resultLabel={
            q.isFetching && !q.isLoading
              ? 'Updating…'
              : `${total} template${total === 1 ? '' : 's'}`
          }
          viewMode={f.viewMode}
          onViewMode={f.setViewMode}
          filters={
            <>
              <SpecialtyFilter
                value={f.specialtyId}
                onChange={f.setSpecialtyId}
              />
              <OwnerFilter value={f.owner} onChange={f.setOwner} />
            </>
          }
        />

        {q.isLoading ? (
          <LoadingSkeleton
            variant={f.viewMode === 'table' ? 'table' : 'cards'}
          />
        ) : q.isError ? (
          <ErrorState onRetry={() => void q.refetch()} />
        ) : total === 0 && f.activeFilters === 0 ? (
          <EmptyState
            icon={Layers}
            title="No stage templates yet"
            description="A stage template lists the try-in rounds an item goes through before the final fit."
            action={addButton}
          />
        ) : total === 0 ? (
          <NoResultsState
            message="No stage templates match your filters."
            onClear={f.clear}
          />
        ) : f.viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={pageRows}
            pagination={false}
            serverPagination={{
              page: f.page,
              pageSize: f.limit,
              total,
              onPageChange: f.setPage,
              onPageSizeChange: f.setLimit,
              pageSizeOptions: [10, 20, 50],
            }}
            onRowClick={edit}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pageRows.map((t) => (
                <article
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => edit(t)}
                  onKeyDown={(e) => e.key === 'Enter' && edit(t)}
                  className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold">
                        {t.name}
                      </h2>
                      <p className="truncate font-mono text-xs text-text-3">
                        {t.code}
                      </p>
                    </div>
                    <ActiveSwitch template={t} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{t.specialty.code}</Badge>
                    <OwnerBadge owner={t.organization} />
                  </div>
                  <div className="mt-auto border-t border-border/60 pt-2">
                    <StepChain template={t} />
                  </div>
                </article>
              ))}
            </div>
            <Pagination
              page={f.page}
              totalPages={Math.max(1, Math.ceil(total / f.limit))}
              limit={f.limit}
              total={total}
              onPageChange={f.setPage}
              onLimitChange={f.setLimit}
              pageSizeOptions={[10, 20, 50]}
            />
          </div>
        )}
      </div>

      <StageTemplateSheet
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        template={sheet?.template ?? null}
      />
    </DashboardLayout>
  )
}

function StepChain({ template }: { template: StageTemplate }) {
  const steps = [...template.steps].sort((a, b) => a.seq - b.seq)
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs">
      {steps.map((s, i) => (
        <li key={s.code} className="flex items-center gap-1">
          {i > 0 && <span className="text-text-3">→</span>}
          <span className="rounded bg-panel-2 px-1.5 py-0.5">
            {s.name}
            <span className="ml-1 text-text-3">{s.defaultLabDays}d</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

function ActiveSwitch({ template }: { template: StageTemplate }) {
  const setActive = useSetStageTemplateActive()
  const label = template.isActive
    ? `Deactivate ${template.code}`
    : `Activate ${template.code}`
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={template.isActive}
              disabled={setActive.isPending}
              aria-label={label}
              onCheckedChange={(isActive) =>
                setActive.mutate({ template, isActive })
              }
            />
          </span>
        </TooltipTrigger>
        <TooltipContent className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
