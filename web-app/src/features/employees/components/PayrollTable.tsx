import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PayrollRecord, PayrollStatus } from '../types'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { PayrollStatusBadge } from './PayrollStatusBadge'
import { Button } from '@/components/ui/button'
import { MarkPaidModal } from './MarkPaidModal'
import { useDeletePayroll } from '../hooks/useDeletePayroll'
import { Pencil, Trash2 } from 'lucide-react'

interface PayrollTableProps {
  records: PayrollRecord[]
  showEmployeeName?: boolean
  onEdit?: (record: PayrollRecord) => void
}

export function PayrollTable({
  records,
  showEmployeeName = false,
  onEdit,
}: PayrollTableProps) {
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const deleteMutation = useDeletePayroll()

  const handleMarkPaidClick = (record: PayrollRecord) => {
    setSelectedRecord(record)
    setIsModalOpen(true)
  }

  const handleDelete = (record: PayrollRecord) => {
    const ok = window.confirm(
      `Delete the payroll record for ${record.employee?.fullName ?? 'this employee'} (${record.periodLabel})? This cannot be undone.`,
    )
    if (ok) deleteMutation.mutate(record.id)
  }

  const columns = useMemo<ColumnDef<PayrollRecord>[]>(
    () => [
      ...(showEmployeeName
        ? [
            {
              accessorKey: 'employee',
              header: 'Employee',
              cell: ({ row }: { row: any }) => (
                <span className="font-medium">
                  {row.original.employee?.fullName || 'Unknown'}
                  {row.original.employee?.employeeCode && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({row.original.employee.employeeCode})
                    </span>
                  )}
                </span>
              ),
            } as ColumnDef<PayrollRecord>,
          ]
        : []),
      {
        accessorKey: 'periodLabel',
        header: 'Period',
        cell: ({ row }) => (
          <div className={!showEmployeeName ? 'font-medium' : ''}>
            {row.original.periodLabel}
            {row.original.notes && (
              <p
                className="text-xs text-muted-foreground truncate max-w-[220px]"
                title={row.original.notes}
              >
                {row.original.notes}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'salaryAmount',
        header: 'Amount',
        cell: ({ getValue }) => formatCurrency(getValue<number>()),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => (
          <PayrollStatusBadge status={getValue<PayrollStatus>()} />
        ),
      },
      {
        accessorKey: 'paidAt',
        header: 'Paid On',
        cell: ({ getValue }) => {
          const val = getValue<string | null>()
          return val ? formatDate(val) : '—'
        },
      },
      {
        accessorKey: 'paymentMethod',
        header: 'Method',
        cell: ({ getValue }) => (
          <span className="capitalize">
            {getValue<string | null>()?.replace('_', ' ') || '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const record = row.original
          return (
            <div className="flex items-center justify-end gap-1">
              {record.status !== 'paid' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMarkPaidClick(record)}
                >
                  Mark as Paid
                </Button>
              )}
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Edit payroll"
                  onClick={() => onEdit(record)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                aria-label="Delete payroll"
                disabled={deleteMutation.isPending}
                onClick={() => handleDelete(record)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        },
      },
    ],
    [showEmployeeName, onEdit, deleteMutation.isPending],
  )

  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No payroll records found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/20 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <MarkPaidModal
        record={selectedRecord}
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  )
}
