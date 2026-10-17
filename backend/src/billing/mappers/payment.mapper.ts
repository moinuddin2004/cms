import { fromPaisa, toPaisa } from '../common/money';
import { Payment } from '../entities/payment.entity';
import { Refund } from '../entities/refund.entity';
import {
  PatientRef,
  PaymentResponse,
  RefundResponse,
} from './billing-response.types';

export function toPaymentResponse(
  p: Payment,
  patient: PatientRef,
  receivedByName: string | null,
): PaymentResponse {
  const refunded = toPaisa(p.refundedAmount);
  const amount = toPaisa(p.amount);
  return {
    id: p.id,
    receiptNumber: p.receiptNumber,
    patient,
    amount: p.amount,
    method: p.method,
    paymentAccountId: p.paymentAccountId,
    paymentAccountName: p.paymentAccountName,
    referenceNumber: p.referenceNumber,
    paymentDate: p.paymentDate,
    receivedAt: p.receivedAt.toISOString(),
    receivedByName,
    notes: p.notes,
    allocatedAmount: p.allocatedAmount,
    refundedAmount: p.refundedAmount,
    advance: fromPaisa(amount - toPaisa(p.allocatedAmount) - refunded),
    refundStatus:
      refunded === 0 ? 'NONE' : refunded >= amount ? 'FULL' : 'PARTIAL',
  };
}

export function toRefundResponse(
  r: Refund,
  patient: PatientRef,
  refundedByName: string | null,
  invoiceNumber: string | null,
): RefundResponse {
  return {
    id: r.id,
    refundNumber: r.refundNumber,
    patient,
    amount: r.amount,
    method: r.method,
    paymentAccountName: r.paymentAccountName,
    referenceNumber: r.referenceNumber,
    reason: r.reason,
    refundDate: r.refundDate,
    refundedAt: r.refundedAt.toISOString(),
    refundedByName,
    invoiceId: r.invoiceId,
    invoiceNumber,
  };
}
