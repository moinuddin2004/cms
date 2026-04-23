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

interface PayrollTableProps {
  records: PayrollRecord[]
  onMarkPaid: (record: PayrollRecord) => void
}

export function PayrollTable({ records, onMarkPaid }: PayrollTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
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
                colSpan={6}
                className="h-24 text-center text-muted-foreground"
              >
                No payroll records found.
              </TableCell>
            </TableRow>
          ) : (
            records.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">
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
                      onClick={() => onMarkPaid(record)}
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
  )
}
