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

interface PayrollTableProps {
  records: PayrollRecord[]
  showEmployeeName?: boolean
}

export function PayrollTable({ records, showEmployeeName = false }: PayrollTableProps) {
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleMarkPaidClick = (record: PayrollRecord) => {
    setSelectedRecord(record)
    setIsModalOpen(true)
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
              <TableHead className="text-right">Action</TableHead>
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
                    {record.status === 'paid' ? (
                      <span className="text-sm font-medium text-green-600 px-3 py-1">
                        ✓ Paid
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkPaidClick(record)}
                      >
                        Mark as Paid
                      </Button>
                    )}
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
