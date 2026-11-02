import { useMemo, useState } from 'react'
import { formatMinor } from '@/features/billing/lib/commission-math'
import type { ColumnDef } from '@/components/shared/table-features'
import type { PayrollRecord, PayrollStatus } from '../types'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { PayrollStatusBadge } from './PayrollStatusBadge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/DataTable'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
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
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(
    null,
  )
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleting, setDeleting] = useState<PayrollRecord | null>(null)
  const deleteMutation = useDeletePayroll()

  const handleMarkPaidClick = (record: PayrollRecord) => {
    setSelectedRecord(record)
    setIsModalOpen(true)
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
            {!!row.original.commissionMinor && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Salary {formatMinor(row.original.baseSalaryMinor ?? 0)} +
                commission {formatMinor(row.original.commissionMinor)}
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
                <TooltipButton
                  tooltip="Edit payroll"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit(record)}
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </TooltipButton>
              )}
              <TooltipButton
                tooltip="Delete payroll"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleting(record)}
              >
                <Trash2 className="h-4 w-4" />
              </TooltipButton>
            </div>
          )
        },
      },
    ],
    [showEmployeeName, onEdit],
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

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete payroll record?"
        description={
          deleting
            ? `The ${deleting.periodLabel} record for ${deleting.employee?.fullName ?? 'this employee'} will be removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          deleting &&
          deleteMutation.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
          })
        }
      />
    </>
  )
}
