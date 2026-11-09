import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { useNavigate } from '@tanstack/react-router'
import { FileSpreadsheet, Plus } from 'lucide-react'
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
import { formatMinor } from '@/features/lab-catalog'
import { StatementStatusBadge } from '../components/payables-badges'
import {
  ALL,
  LabFilter,
  PayablesNav,
  useClinicLabs,
} from '../components/PayablesNav'
import { StatementSheet } from '../components/StatementSheet'
import { useLabStatements, usePayablesMutation } from '../hooks/useLabPayables'
import { parseStatementLines } from '../schemas/lab-payables.schema'
import type { StatementValues } from '../schemas/lab-payables.schema'
import { labPayablesApi } from '../services/lab-payables.api'
import { STATEMENT_STATUS_LABEL } from '../types'
import type { LabStatement, StatementStatus } from '../types'

const problems = (s: LabStatement) =>
  (s.counts?.amount_mismatch ?? 0) +
  (s.counts?.missing_in_system ?? 0) +
  (s.counts?.missing_in_statement ?? 0)

/** Monthly lab statements and how they reconcile with the bills. */
export function LabStatementsPage() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [search, setSearch] = useState('')
  const [labId, setLabId] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [adding, setAdding] = useState(false)
  const labs = useClinicLabs()
  const { data, isLoading, isError, refetch, isFetching } = useLabStatements({
    page,
    limit,
    labId: labId === ALL ? undefined : labId,
    status: status === ALL ? undefined : status,
  })
  const create = usePayablesMutation(
    (v: StatementValues) =>
      labPayablesApi.createStatement({
        labId: v.labId,
        periodStart: v.periodStart,
        periodEnd: v.periodEnd,
        statementRef: v.statementRef || undefined,
        lines: parseStatementLines(v.lines).lines,
      }),
    'Statement saved and reconciled',
  )

  const q = search.trim().toLowerCase()
  const rows = (data?.data ?? []).filter(
    (s) => !q || (s.statementRef ?? '').toLowerCase().includes(q),
  )
  const total = data?.total ?? 0
  const activeFilters =
    (q ? 1 : 0) + (labId !== ALL ? 1 : 0) + (status !== ALL ? 1 : 0)
  const clear = () => {
    setSearch('')
    setLabId(ALL)
    setStatus(ALL)
    setPage(1)
  }
  const open = (s: LabStatement) =>
    void navigate({
      to: '/lab-payables/statements/$statementId',
      params: { statementId: s.id },
    })

  const columns = useMemo<ColumnDef<LabStatement, unknown>[]>(
    () => [
      {
        id: 'period',
        header: 'Period',
        accessorKey: 'periodStart',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold">
              {row.original.periodStart} – {row.original.periodEnd}
            </p>
            <p className="text-xs text-text-3">
              {row.original.statementRef ?? '—'}
            </p>
          </div>
        ),
      },
      { id: 'lab', header: 'Lab', accessorFn: (s) => s.labName ?? '' },
      {
        id: 'total',
        header: 'Lab says',
        accessorKey: 'totalMinor',
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMinor(row.original.totalMinor)}
          </span>
        ),
      },
      {
        id: 'issues',
        header: 'To check',
        accessorFn: problems,
        cell: ({ row }) => (
          <span className="tabular-nums">{problems(row.original)}</span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => (
          <StatementStatusBadge status={row.original.status} />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => open(row.original)}>
            Open
          </Button>
        ),
      },
    ],
    [],
  )
  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <Plus className="size-4" /> Add statement
    </Button>
  )
  const onPageSize = (size: number) => {
    setLimit(size)
    setPage(1)
  }

  return (
    <DashboardLayout
      title="Lab payables"
      subtitle="Monthly lab statements, matched against your bills."
      actions={addButton}
    >
      <div className="space-y-4">
        <PayablesNav active="/lab-payables/statements" />
        <ListToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search statement ref…"
          activeFilters={activeFilters}
          onClear={clear}
          resultLabel={
            isFetching && !isLoading
              ? 'Updating…'
              : `${total} statement${total === 1 ? '' : 's'}`
          }
          viewMode={viewMode}
          onViewMode={setViewMode}
          filters={
            <>
              <LabFilter
                value={labId}
                labs={labs}
                onChange={(v) => {
                  setLabId(v)
                  setPage(1)
                }}
              />
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v)
                  setPage(1)
                }}
              >
                <SelectTrigger
                  className="h-9 w-full sm:w-40"
                  aria-label="Filter by status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {(
                    Object.keys(STATEMENT_STATUS_LABEL) as StatementStatus[]
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATEMENT_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
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
            icon={FileSpreadsheet}
            title="No lab statements yet"
            description="When a lab sends its monthly statement, add it here to see what matches your bills."
            action={addButton}
          />
        ) : rows.length === 0 ? (
          <NoResultsState
            message="No statements match your filters."
            onClear={clear}
          />
        ) : viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={rows}
            pagination={false}
            onRowClick={open}
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
              {rows.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => open(s)}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{s.labName}</p>
                      <p className="text-xs text-text-3">
                        {s.periodStart} – {s.periodEnd}
                      </p>
                    </div>
                    <StatementStatusBadge status={s.status} />
                  </div>
                  <div className="flex justify-between border-t border-border/60 pt-2 text-xs text-text-3">
                    <span>{problems(s)} to check</span>
                    <span className="tabular-nums text-foreground">
                      {formatMinor(s.totalMinor)}
                    </span>
                  </div>
                </button>
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
      <StatementSheet
        open={adding}
        labs={labs}
        onOpenChange={setAdding}
        onSubmit={async (v) => {
          const s = await create.mutateAsync(v)
          void navigate({
            to: '/lab-payables/statements/$statementId',
            params: { statementId: s.id },
          })
        }}
      />
    </DashboardLayout>
  )
}
