import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type {
  Charge,
  InvoicePaymentStatus,
  InvoiceRefundStatus,
  InvoiceStatus,
  OutstandingRow,
} from '../../types/billing.types'

type Tone = 'success' | 'warning' | 'danger' | 'muted' | 'violet' | 'info'

const CHIP = 'px-1.5 py-0 text-[10px]'

/** Right-aligned, tabular money (plan §8.5). */
export function Money({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <span className={cn('tabular-nums', className)}>
      {formatCurrency(value)}
    </span>
  )
}

const PAYMENT_TONE: Record<
  InvoicePaymentStatus,
  { label: string; tone: Tone }
> = {
  PAID: { label: 'Paid', tone: 'success' },
  PARTIALLY_PAID: { label: 'Partially paid', tone: 'warning' },
  UNPAID: { label: 'Unpaid', tone: 'muted' },
  OVERDUE: { label: 'Overdue', tone: 'danger' },
}

/**
 * One badge set for every invoice (project soft chips): Paid / Partially
 * paid / Unpaid / Overdue / Cancelled / Refunded.
 */
export function PaymentStatusBadge({
  status,
  paymentStatus,
  refundStatus,
  refundedAmount = 0,
}: {
  status: InvoiceStatus
  paymentStatus: InvoicePaymentStatus | null
  refundStatus?: InvoiceRefundStatus
  refundedAmount?: number
}) {
  if (status === 'CANCELLED') return <Badge variant="muted">Cancelled</Badge>
  if (refundStatus === 'FULLY_REFUNDED') {
    return <Badge variant="violet">Refunded</Badge>
  }
  const s = PAYMENT_TONE[paymentStatus ?? 'UNPAID']
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={s.tone}>{s.label}</Badge>
      {refundStatus === 'PARTIALLY_REFUNDED' && (
        <Badge variant="violet">
          Refunded {formatCurrency(refundedAmount)}
        </Badge>
      )}
    </span>
  )
}

/** "Needs price", "Review", "Void" and "Paid" chips of one charge. */
export function ChargeBadges({ charge }: { charge: Charge }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {charge.status === 'VOID' && (
        <Badge variant="muted" className={CHIP}>
          Void
        </Badge>
      )}
      {charge.needsPricing && (
        <Badge variant="warning" className={CHIP}>
          Needs price
        </Badge>
      )}
      {charge.needsReview && (
        <Badge variant="danger" className={CHIP}>
          Review
        </Badge>
      )}
      {charge.status === 'ACTIVE' &&
        charge.invoiceId &&
        charge.paymentState === 'PAID' && (
          <Badge variant="success" className={CHIP}>
            Paid
          </Badge>
        )}
    </span>
  )
}

/** "Rs 2,000 due" / "Advance Rs 500" for queue rows and the patient header (D22). */
export function OutstandingBadge({
  row,
  className,
}: {
  row: OutstandingRow | undefined
  className?: string
}) {
  if (!row) return null
  if (row.outstanding > 0) {
    return (
      <Badge variant="danger" className={cn('gap-1', CHIP, className)}>
        {row.hasOverdue && (
          <span
            className="size-1.5 rounded-full bg-danger"
            aria-label="Overdue"
          />
        )}
        {formatCurrency(row.outstanding)} due
      </Badge>
    )
  }
  if (row.advance > 0) {
    return (
      <Badge variant="success" className={cn(CHIP, className)}>
        Advance {formatCurrency(row.advance)}
      </Badge>
    )
  }
  return null
}
