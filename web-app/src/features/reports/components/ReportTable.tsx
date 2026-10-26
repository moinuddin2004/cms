import { useMemo } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { DataTable } from '@/components/shared/DataTable'
import { cn } from '@/lib/utils'
import { formatReportValue } from '../lib/report-format'
import type { ReportColumn, ReportRow } from '../types/reports.types'

const STATUS_TONE: Record<string, string> = {
  Paid: 'border-emerald/20 bg-emerald-soft text-emerald',
  Overdue: 'border-danger/20 bg-danger-soft text-danger',
  'Partly paid': 'border-amber/20 bg-amber-soft text-amber',
  'Partially Paid': 'border-amber/20 bg-amber-soft text-amber',
  Pending: 'border-amber/20 bg-amber-soft text-amber',
  Unpaid: 'border-border bg-muted text-muted-foreground',
}

const numeric = (c: ReportColumn) =>
  c.type === 'money' ||
  c.type === 'number' ||
  c.type === 'decimal' ||
  c.type === 'percent'

/** Any report's rows in the project table: sortable, paginated, typed cells. */
export function ReportTable({
  columns,
  rows,
  isLoading,
  emptyMessage,
}: {
  columns: ReportColumn[]
  rows: ReportRow[]
  isLoading?: boolean
  emptyMessage: string
}) {
  const defs = useMemo<ColumnDef<ReportRow, unknown>[]>(
    () =>
      columns.map((c) => ({
        id: c.key,
        accessorFn: (r) => r[c.key],
        header: () => (
          <span className={cn(numeric(c) && 'block text-right')}>
            {c.header}
          </span>
        ),
        sortFn: numeric(c) ? 'basic' : 'alphanumeric',
        cell: ({ row }) => {
          const v = row.original[c.key]
          if (c.key === 'status' && typeof v === 'string') {
            return (
              <span
                className={cn(
                  'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  STATUS_TONE[v] ??
                    'border-border bg-muted text-muted-foreground',
                )}
              >
                {v}
              </span>
            )
          }
          return (
            <span
              className={cn(
                'text-sm',
                numeric(c) && 'block text-right tabular-nums',
                c.type === 'money' && Number(v) < 0 && 'text-danger',
                c.type === 'text' && !v && 'text-muted-foreground',
              )}
            >
              {formatReportValue(v, c.type) || '—'}
            </span>
          )
        },
      })),
    [columns],
  )

  return (
    <DataTable
      columns={defs}
      data={rows}
      isLoading={isLoading}
      skeletonRows={8}
      defaultPageSize={20}
      pageSizeOptions={[20, 50, 100, 500]}
      emptyMessage={emptyMessage}
    />
  )
}
