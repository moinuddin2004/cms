import { useMemo, useState } from 'react'
import { formatPaisa } from '@/features/billing/lib/commission-math'
import { type ColumnDef } from '@/components/shared/table-features'
import type { PayrollRecord, PayrollStatus } from '../types'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { PayrollStatusBadge } from './PayrollStatusBadge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/DataTable'
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

  const columns = useMemo<ColumnDef<PayrollRecord, unknown>[]>(
    () => [
      ...(showEmployeeName
        ? [
            {
              accessorKey: 'employee',
              header: 'Employee',
              enableSorting: false,
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
            } as ColumnDef<PayrollRecord, unknown>,
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
        cell: ({ row }) => (
          <div>
            <span className="font-medium">
              {formatCurrency(Number(row.original.salaryAmount))}
            </span>
            {!!row.original.commissionPaisa && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Salary {formatPaisa(row.original.baseSalaryPaisa ?? 0)} +
                commission {formatPaisa(row.original.commissionPaisa)}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ getValue }) => (
          <PayrollStatusBadge status={getValue<PayrollStatus>()} />
        ),
      },
      {
        accessorKey: 'paidAt',
        header: 'Paid On',
        cell: ({ getValue }) => {
          const val = getValue<string | null>()
          return (
            <span className="text-muted-foreground">
              {val ? formatDate(val) : '—'}
            </span>
          )
        },
      },
      {
        accessorKey: 'paymentMethod',
        header: 'Method',
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="capitalize">
            {getValue<string | null>()?.replace('_', ' ') || '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
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
                  <Pencil className="h-4 w-4 text-muted-foreground" />
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

  return (
    <>
      <DataTable
        columns={columns}
        data={records}
        emptyMessage="No payroll records found."
        pagination
      />

      <MarkPaidModal
        record={selectedRecord}
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  )
}
