import { toPaisa } from '../common/money';
import {
  InvoicePaymentStatus,
  InvoiceRefundStatus,
  InvoiceStatus,
} from '../enums/billing.enums';

/** Payment status, computed — never stored (D16, 6.13). Pure. */
export function invoicePaymentStatus(
  inv: {
    status: InvoiceStatus;
    paidAmount: number;
    balanceDue: number;
    dueDate: string;
  },
  today: string,
): InvoicePaymentStatus | null {
  if (inv.status === InvoiceStatus.CANCELLED) return null;
  if (toPaisa(inv.balanceDue) <= 0) return InvoicePaymentStatus.PAID;
  if (inv.dueDate < today) return InvoicePaymentStatus.OVERDUE;
  if (toPaisa(inv.paidAmount) > 0) return InvoicePaymentStatus.PARTIALLY_PAID;
  return InvoicePaymentStatus.UNPAID;
}

/** Refund status (6.18). Pure. */
export function invoiceRefundStatus(inv: {
  paidAmount: number;
  releasedAmount: number;
  refundedAmount: number;
}): InvoiceRefundStatus {
  const refunded = toPaisa(inv.refundedAmount);
  if (refunded === 0) return InvoiceRefundStatus.NONE;
  const nothingLeftOnInvoice = toPaisa(inv.paidAmount) === 0;
  const nothingLeftToRefund = refunded === toPaisa(inv.releasedAmount);
  return nothingLeftOnInvoice && nothingLeftToRefund
    ? InvoiceRefundStatus.FULLY_REFUNDED
    : InvoiceRefundStatus.PARTIALLY_REFUNDED;
}

/** releasedAmount − refundedAmount, in paisa. */
export const refundablePaisa = (inv: {
  releasedAmount: number;
  refundedAmount: number;
}): number =>
  Math.max(0, toPaisa(inv.releasedAmount) - toPaisa(inv.refundedAmount));

/** List filter value: payment statuses plus the two document states. */
export type InvoiceListStatus = InvoicePaymentStatus | 'REFUNDED' | 'CANCELLED';

/**
 * The same rules as `invoicePaymentStatus` as a SQL predicate on alias `i`,
 * with `:today` bound by the caller (6.13).
 */
export function paymentStatusSql(status: InvoiceListStatus): string {
  const issued = `i.status = 'ISSUED'`;
  switch (status) {
    case 'CANCELLED':
      return `i.status = 'CANCELLED'`;
    case 'REFUNDED':
      return `i.refunded_amount > 0`;
    case InvoicePaymentStatus.PAID:
      return `${issued} AND i.balance_due <= 0`;
    case InvoicePaymentStatus.OVERDUE:
      return `${issued} AND i.balance_due > 0 AND i.due_date < :today`;
    case InvoicePaymentStatus.PARTIALLY_PAID:
      return `${issued} AND i.balance_due > 0 AND i.due_date >= :today AND i.paid_amount > 0`;
    case InvoicePaymentStatus.UNPAID:
      return `${issued} AND i.balance_due > 0 AND i.due_date >= :today AND i.paid_amount <= 0`;
  }
}
