import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PayrollRecord } from '../types'
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
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(
    null,
  )
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

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {showEmployeeName && <TableHead>Employee</TableHead>}
              <TableHead>Period</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid On</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showEmployeeName ? 7 : 6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No payroll records found.
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id}>
                  {showEmployeeName && (
                    <TableCell className="font-medium">
                      {record.employee?.fullName || 'Unknown'}
                      {record.employee?.employeeCode && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({record.employee.employeeCode})
                        </span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className={!showEmployeeName ? 'font-medium' : ''}>
                    {record.periodLabel}
                    {record.notes && (
                      <p
                        className="text-xs text-muted-foreground truncate max-w-[220px]"
                        title={record.notes}
                      >
                        {record.notes}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{formatCurrency(record.salaryAmount)}</TableCell>
                  <TableCell>
                    <PayrollStatusBadge status={record.status} />
                  </TableCell>
                  <TableCell>
                    {record.paidAt ? formatDate(record.paidAt) : '—'}
                  </TableCell>
                  <TableCell className="capitalize">
                    {record.paymentMethod?.replace('_', ' ') || '—'}
                  </TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
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
