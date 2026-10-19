import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useNavigate } from '@tanstack/react-router'
import { FileJson, GitBranch, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { DefinitionCard } from '../components/DefinitionCard'
import { DefinitionSheet } from '../components/DefinitionSheet'
import {
  EntityTypeFilter,
  OwnerFilter,
  SpecialtyFilter,
} from '../components/StudioFilters'
import { OwnerBadge, VersionSummary } from '../components/studio-badges'
import type { DefinitionKind } from '../hooks/useDefinitionForm'
import { useFormSchemas } from '../hooks/useFormSchemas'
import { useStudioListFilters } from '../hooks/useStudioListFilters'
import { useWorkflowTemplates } from '../hooks/useWorkflows'
import { ENTITY_TYPE_LABEL } from '../types'
import type {
  FormSchemaSummary,
  WorkflowEntityType,
  WorkflowTemplateSummary,
} from '../types'

type Row = FormSchemaSummary | WorkflowTemplateSummary

const COPY: Record<
  DefinitionKind,
  {
    title: string
    subtitle: string
    noun: string
    empty: string
    emptyText: string
  }
> = {
  form: {
    title: 'Form schemas',
    subtitle:
      'Order forms per specialty — JSON definition with a live preview. Platform admins only.',
    noun: 'form',
    empty: 'No form schemas yet',
    emptyText:
      'Forms define what a clinic fills in for each order item (teeth, shade, material…).',
  },
  workflow: {
    title: 'Workflows',
    subtitle:
      'States and transitions for orders, items and stages. Platform admins only.',
    noun: 'workflow',
    empty: 'No workflows yet',
    emptyText:
      'Workflows say which status changes are allowed, by whom, and what they trigger.',
  },
}

/** Form schemas or workflow templates listing (Configuration Studio). */
export function DefinitionsListPage({ kind }: { kind: DefinitionKind }) {
  const navigate = useNavigate()
  const copy = COPY[kind]
  const [creating, setCreating] = useState(false)

  // Specialty / owner / entity filter on the server; search + paging here.
  const f = useStudioListFilters()
  const forms = useFormSchemas(
    { specialtyId: f.server.specialtyId, owner: f.server.owner },
    kind === 'form',
  )
  const workflows = useWorkflowTemplates(
    {
      specialtyId: f.server.specialtyId,
      owner: f.server.owner,
      entityType: f.server.entityType as WorkflowEntityType | undefined,
    },
    kind === 'workflow',
  )
  const q = kind === 'form' ? forms : workflows
  const { filtered, pageRows } = f.apply(q.data as Row[] | undefined)

  const open = (row: Row) =>
    void navigate(
      kind === 'form'
        ? { to: '/studio/forms/$formId', params: { formId: row.id } }
        : {
            to: '/studio/workflows/$workflowId',
            params: { workflowId: row.id },
          },
    )

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
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
        id: 'specialty',
        header: 'Specialty',
        accessorFn: (r) => r.specialty.name,
        cell: ({ row }) => (
          <span className="text-sm">{row.original.specialty.name}</span>
        ),
      },
      ...(kind === 'workflow'
        ? [
            {
              id: 'entityType',
              header: 'Runs on',
              accessorFn: (r: Row) => (r as WorkflowTemplateSummary).entityType,
              cell: ({ row }: { row: { original: Row } }) => (
                <Badge variant="info">
                  {
                    ENTITY_TYPE_LABEL[
                      (row.original as WorkflowTemplateSummary).entityType
                    ]
                  }
                </Badge>
              ),
            } satisfies ColumnDef<Row, unknown>,
          ]
        : []),
      {
        id: 'owner',
        header: 'Owner',
        accessorFn: (r) => r.organization?.name ?? '',
        cell: ({ row }) => <OwnerBadge owner={row.original.organization} />,
      },
      {
        id: 'versions',
        header: 'Versions',
        enableSorting: false,
        cell: ({ row }) => (
          <VersionSummary
            current={row.original.current}
            draft={row.original.draft}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                open(row.original)
              }}
            >
              Open
            </Button>
          </div>
        ),
      },
    ],
    [kind],
  )

  const addButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-4" /> New {copy.noun}
    </Button>
  )
  const total = filtered.length

  return (
    <DashboardLayout
      title={copy.title}
      subtitle={copy.subtitle}
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
              : `${total} ${copy.noun}${total === 1 ? '' : 's'}`
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
              {kind === 'workflow' && (
                <EntityTypeFilter
                  value={f.entityType}
                  onChange={f.setEntityType}
                />
              )}
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
            icon={kind === 'form' ? FileJson : GitBranch}
            title={copy.empty}
            description={copy.emptyText}
            action={addButton}
          />
        ) : total === 0 ? (
          <NoResultsState
            message={`No ${copy.noun}s match your filters.`}
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
            onRowClick={open}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pageRows.map((row) => (
                <DefinitionCard
                  key={row.id}
                  item={row}
                  onOpen={() => open(row)}
                />
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

      <DefinitionSheet
        open={creating}
        onOpenChange={setCreating}
        kind={kind}
        onCreated={(id) =>
          void navigate(
            kind === 'form'
              ? { to: '/studio/forms/$formId', params: { formId: id } }
              : {
                  to: '/studio/workflows/$workflowId',
                  params: { workflowId: id },
                },
          )
        }
      />
    </DashboardLayout>
  )
}

export const FormSchemasPage = () => <DefinitionsListPage kind="form" />
export const WorkflowsPage = () => <DefinitionsListPage kind="workflow" />
