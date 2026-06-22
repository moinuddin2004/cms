import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Loader2,
  ArrowLeft,
  Download,
  Send,
  Ban,
  Tag,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import {
  useInvoice,
  useUpdateInvoiceStatus,
  useApplyCoupon,
  useRemoveCoupon,
} from '@/features/billing/hooks/useInvoices'
import { RecordPaymentDialog } from '@/features/billing/components/RecordPaymentDialog'
import { downloadReceiptPdf } from '@/features/billing/services/billing.api'
import { InvoiceStatus, STATUS_BADGE } from '@/features/billing/types'

export const Route = createFileRoute('/invoices/$invoiceId')({
  component: InvoiceDetailPage,
})

const PAYABLE = [
  InvoiceStatus.PENDING,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
]

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams()
  const navigate = useNavigate()
  const { data: invoice, isLoading } = useInvoice(invoiceId)
  const updateStatus = useUpdateInvoiceStatus(invoiceId)
  const applyCoupon = useApplyCoupon(invoiceId)
  const removeCoupon = useRemoveCoupon(invoiceId)
  const [couponCode, setCouponCode] = useState('')
  const [downloading, setDownloading] = useState(false)

  if (isLoading || !invoice) {
    return (
      <DashboardLayout title="Invoice">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  const isDraft = invoice.status === InvoiceStatus.DRAFT
  const isPayable = PAYABLE.includes(invoice.status)
  const hasPayments = Number(invoice.paidAmount) > 0

  const handleDownload = async () => {
    try {
      setDownloading(true)
      const blob = await downloadReceiptPdf(invoiceId)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch {
      toast.error('Failed to generate receipt')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <DashboardLayout
      title={`Invoice ${invoice.invoiceNumber}`}
      subtitle={invoice.patient?.fullName ?? ''}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: '/invoices' })}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
          </Button>
          {isDraft && (
            <Button
              variant="outline"
              onClick={() => updateStatus.mutate(InvoiceStatus.PENDING)}
              disabled={updateStatus.isPending}
            >
              <Send className="mr-1.5 h-4 w-4" /> Send
            </Button>
          )}
          {isPayable && (
            <RecordPaymentDialog
              invoiceId={invoiceId}
              balanceDue={Number(invoice.balanceDue)}
            />
          )}
          {hasPayments && (
            <Button variant="outline" onClick={handleDownload} disabled={downloading}>
              {downloading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              Receipt
            </Button>
          )}
          {(isDraft || isPayable) && (
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => updateStatus.mutate(InvoiceStatus.CANCELLED)}
              disabled={updateStatus.isPending}
            >
              <Ban className="mr-1.5 h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Status + dates */}
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <Badge className={cn('border-0', STATUS_BADGE[invoice.status])}>
                {invoice.status.replace(/_/g, ' ')}
              </Badge>
              <div className="text-sm text-muted-foreground">
                Issued {formatDate(invoice.issuedDate ?? undefined)} · Due{' '}
                {formatDate(invoice.dueDate ?? undefined)}
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Line Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invoice.items ?? []).map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.description}</TableCell>
                      <TableCell className="text-right">{it.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(it.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(it.totalPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(invoice.payments ?? []).length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">
                  No payments recorded yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(invoice.payments ?? []).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.paymentDate)}</TableCell>
                        <TableCell>{p.paymentMethod.replace(/_/g, ' ')}</TableCell>
                        <TableCell>{p.referenceNumber ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(p.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Financial summary side */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(invoice.subtotal)} />
              {Number(invoice.discountAmount) > 0 && (
                <Row
                  label="Discount"
                  value={`- ${formatCurrency(invoice.discountAmount)}`}
                />
              )}
              {Number(invoice.taxAmount) > 0 && (
                <Row label={`Tax (${invoice.taxRate}%)`} value={formatCurrency(invoice.taxAmount)} />
              )}
              <div className="my-2 h-px bg-border" />
              <Row label="Total" value={formatCurrency(invoice.totalAmount)} bold />
              <Row label="Paid" value={formatCurrency(invoice.paidAmount)} />
              <Row label="Balance" value={formatCurrency(invoice.balanceDue)} bold />
            </CardContent>
          </Card>

          {/* Coupon (draft only) */}
          {isDraft && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Coupon
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {invoice.couponId ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {invoice.coupon?.code ?? 'Applied'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCoupon.mutate()}
                      disabled={removeCoupon.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Coupon code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                    />
                    <Button
                      onClick={() => applyCoupon.mutate(couponCode.trim())}
                      disabled={applyCoupon.isPending || !couponCode.trim()}
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

function Row({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-bold' : ''}>{value}</span>
    </div>
  )
}
