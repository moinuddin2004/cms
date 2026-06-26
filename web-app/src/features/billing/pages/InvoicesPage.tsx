import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Loader2, Receipt, AlertCircle, Wallet, TrendingUp } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { useInvoices, useInvoiceStats } from '@/features/billing/hooks/useInvoices'
import { CreateInvoiceDialog } from '@/features/billing/components/CreateInvoiceDialog'
import { InvoiceStatus, STATUS_BADGE } from '@/features/billing/types'
import { StatCard } from '@/components/shared'

const STATUS_TABS: Array<{ label: string; value?: InvoiceStatus }> = [
  { label: 'All' },
  { label: 'Draft', value: InvoiceStatus.DRAFT },
  { label: 'Pending', value: InvoiceStatus.PENDING },
  { label: 'Partially Paid', value: InvoiceStatus.PARTIALLY_PAID },
  { label: 'Paid', value: InvoiceStatus.PAID },
  { label: 'Overdue', value: InvoiceStatus.OVERDUE },
]

export function InvoicesPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<InvoiceStatus | undefined>(undefined)
  const { data: stats } = useInvoiceStats()
  const { data: page, isLoading } = useInvoices({ status, limit: 20 })

  return (
    <PageWrapper
      title="Invoices"
      subtitle="Billing and payment tracking"
      actions={<CreateInvoiceDialog />}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard
            label="Total Revenue"
            value={formatCurrency(stats?.totalRevenue ?? 0)}
            icon={TrendingUp}
            iconTone="emerald"
          />
          <StatCard
            label="Outstanding"
            value={formatCurrency(stats?.outstandingAmount ?? 0)}
            icon={Wallet}
            iconTone="amber"
          />
          <StatCard
            label="Overdue"
            value={String(stats?.overdueCount ?? 0)}
            icon={AlertCircle}
            iconTone="danger"
          />
          <StatCard
            label="Total Invoices"
            value={String(stats?.totalInvoices ?? 0)}
            icon={Receipt}
            iconTone="primary"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((t) => (
            <Button
              key={t.label}
              size="sm"
              variant={status === t.value ? 'default' : 'outline'}
              onClick={() => setStatus(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        <Card className="py-0">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="size-8 animate-spin text-text-3" />
              </div>
            ) : (page?.data.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-text-3">
                <Receipt className="mb-2 size-8 opacity-30" />
                <p>No invoices found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page!.data.map((inv) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate({
                          to: '/invoices/$invoiceId',
                          params: { invoiceId: inv.id },
                        })
                      }
                    >
                      <TableCell className="font-mono text-xs">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell>{inv.patient?.fullName ?? '—'}</TableCell>
                      <TableCell>
                        {formatDate(inv.issuedDate ?? undefined)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(inv.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(inv.balanceDue)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn('border-0', STATUS_BADGE[inv.status])}
                        >
                          {inv.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  )
}
