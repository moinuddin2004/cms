import { useMemo, useState } from 'react'
import type { ColumnDef } from '@/components/shared/table-features'
import { DataTable } from '@/components/shared/DataTable'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import { formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useStatement } from '../../hooks/use-billing-queries'
import type { StatementRow } from '../../types/billing.types'
import { PrintButton } from '../print/PrintButton'
import { Money } from '../shared/billing-badges'

type Row = Pick<
  StatementRow,
  'id' | 'description' | 'debit' | 'credit' | 'balance'
> & {
  entryDate: string | null
  marker?: boolean
}

/** Running-balance statement (6.14): opening, rows, closing. */
export function StatementPanel({ patientId }: { patientId: string }) {
  const [range, setRange] = useState<{ from?: string; to?: string }>({})
  const statement = useStatement(patientId, range)
  const s = statement.data

  const rows = useMemo<Row[]>(() => {
    if (!s) return []
    return [
      {
        id: 'opening',
        entryDate: null,
        description: 'Opening balance',
        debit: 0,
        credit: 0,
        balance: s.openingBalance,
        marker: true,
      },
      ...s.rows,
      {
        id: 'closing',
        entryDate: null,
        description: 'Closing balance',
        debit: 0,
        credit: 0,
        balance: s.closingBalance,
        marker: true,
      },
    ]
  }, [s])

  const columns = useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: 'date',
        header: 'Date',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.entryDate ? formatDate(row.original.entryDate) : '',
      },
      {
        id: 'description',
        header: 'Description',
        enableSorting: false,
        cell: ({ row }) => (
          <span className={cn(row.original.marker && 'font-semibold')}>
            {row.original.description}
          </span>
        ),
      },
      {
        id: 'debit',
        header: 'Debit',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.debit ? <Money value={row.original.debit} /> : '',
      },
      {
        id: 'credit',
        header: 'Credit',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.credit ? <Money value={row.original.credit} /> : '',
      },
      {
        id: 'balance',
        header: 'Balance',
        enableSorting: false,
        cell: ({ row }) => (
          <Money
            value={row.original.balance}
            className={cn(row.original.marker && 'font-semibold')}
          />
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker
          aria-label="Statement period"
          className="h-8 w-full sm:w-[260px] text-xs"
          value={range}
          onChange={setRange}
          placeholder="All dates"
        />
        <div className="ml-auto">
          <PrintButton
            documentType="statement"
            id={patientId}
            label="Print statement"
            params={range}
          />
        </div>
      </div>
      {statement.isLoading ? (
        <LoadingSkeleton variant="table" rows={4} />
      ) : statement.isError || !s ? (
        <ErrorState onRetry={() => void statement.refetch()} />
      ) : s.rows.length === 0 && s.openingBalance === 0 ? (
        <EmptyState
          title="No billing history"
          description="Invoices, payments and refunds will appear here."
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          pagination={false}
          getRowClassName={(r) => (r.marker ? 'bg-panel' : undefined)}
        />
      )}
      <p className="text-xs text-text-3">
        Positive balance = patient owes; negative = clinic holds advance.
      </p>
    </div>
  )
}
