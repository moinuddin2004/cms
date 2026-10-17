import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import type { ServerPagination } from '@/components/shared/DataTable'
import { InitialsAvatar } from '@/components/shared'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { formatDate } from '@/lib/formatters'
import type { Invoice } from '../../types/billing.types'
import { Money, PaymentStatusBadge } from '../shared/billing-badges'

/** Invoice rows for the invoices page and the patient tab (shared DataTable). */
export function InvoiceTable({
  invoices,
  showPatient = true,
  serverPagination,
}: {
  invoices: Invoice[]
  showPatient?: boolean
  serverPagination?: ServerPagination
}) {
  const columns = useMemo<ColumnDef<Invoice, unknown>[]>(
    () => [
      {
        accessorKey: 'invoiceNumber',
        header: 'Invoice',
        cell: ({ row }) => (
          <div>
            <Link
              to="/invoices/$invoiceId"
              params={{ invoiceId: row.original.id }}
              className="font-mono text-[13px] font-semibold text-foreground transition-colors hover:text-primary"
            >
              {row.original.invoiceNumber}
            </Link>
            {row.original.revision > 1 && (
              <p className="text-[11px] text-muted-foreground">
                Rev {row.original.revision}
              </p>
            )}
          </div>
        ),
      },
      ...(showPatient
        ? [
            {
              id: 'patient',
              header: 'Patient',
              accessorFn: (r: Invoice) => r.patient.name,
              cell: ({ row }: { row: { original: Invoice } }) => (
                <div className="flex items-center gap-3">
                  <InitialsAvatar
                    name={row.original.patient.name}
                    seed={row.original.patient.id}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p dir="auto" className="truncate text-sm font-semibold">
                      {row.original.patient.name}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {row.original.patient.mrn ?? row.original.patient.phone}
                    </p>
                  </div>
                </div>
              ),
            } satisfies ColumnDef<Invoice, unknown>,
          ]
        : []),
      {
        accessorKey: 'issueDate',
        header: 'Issued',
        cell: ({ row }) => formatDate(row.original.issueDate),
      },
      {
        accessorKey: 'dueDate',
        header: 'Due',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.dueDate)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => (
          <PaymentStatusBadge
            status={row.original.status}
            paymentStatus={row.original.paymentStatus}
            refundStatus={row.original.refundStatus}
            refundedAmount={row.original.refundedAmount}
          />
        ),
      },
      {
        accessorKey: 'totalAmount',
        header: 'Total',
        cell: ({ row }) => <Money value={row.original.totalAmount} />,
      },
      {
        accessorKey: 'balanceDue',
        header: 'Balance',
        cell: ({ row }) => (
          <Money
            value={row.original.balanceDue}
            className={
              row.original.balanceDue > 0
                ? 'font-semibold'
                : 'text-muted-foreground'
            }
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <TooltipButton
              tooltip="Open invoice"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              asChild
            >
              <Link
                to="/invoices/$invoiceId"
                params={{ invoiceId: row.original.id }}
              >
                <Eye className="h-4 w-4 text-muted-foreground" />
              </Link>
            </TooltipButton>
          </div>
        ),
      },
    ],
    [showPatient],
  )

  return (
    <DataTable
      columns={columns}
      data={invoices}
      pagination={!!serverPagination}
      serverPagination={serverPagination}
      emptyMessage="No invoices found."
    />
  )
}
