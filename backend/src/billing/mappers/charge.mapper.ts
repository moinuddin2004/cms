import { toPaisa, fromPaisa } from '../common/money';
import { Charge } from '../entities/charge.entity';
import { ChargeStatus } from '../enums/billing.enums';
import { chargePayablePaisa } from '../tax/invoice-tax';
import { ChargePaymentState, ChargeResponse } from './billing-response.types';

/** Same rule as invoices, without OVERDUE (6.13). Payable = net + tax. */
export function chargePaymentState(
  payablePaisa: number,
  allocatedPaisa: number,
): ChargePaymentState {
  if (allocatedPaisa >= payablePaisa) return 'PAID';
  return allocatedPaisa > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
}

/** Expects `doctor` and `invoice` relations when names are wanted. */
export function toChargeResponse(c: Charge): ChargeResponse {
  const payable = chargePayablePaisa(c);
  const allocated = toPaisa(c.allocatedAmount);
  return {
    id: c.id,
    patientId: c.patientId,
    source: c.source,
    serviceId: c.serviceId,
    description: c.description,
    doctorId: c.doctorId,
    doctorName: c.doctor?.fullName ?? null,
    chargeDate: c.chargeDate,
    quantity: c.quantity,
    unitPrice: c.unitPrice,
    grossAmount: c.grossAmount,
    discount:
      c.discountName && c.discountKind
        ? {
            typeId: c.discountTypeId,
            name: c.discountName,
            kind: c.discountKind,
            value: c.discountValue ?? 0,
            amount: c.discountAmount,
            note: c.discountNote,
            isCustom: c.isCustomDiscount,
          }
        : null,
    netAmount: c.netAmount,
    taxAmount: c.status === ChargeStatus.VOID ? 0 : (c.taxAmount ?? 0),
    payableAmount: fromPaisa(payable),
    allocatedAmount: c.allocatedAmount,
    balance: fromPaisa(Math.max(0, payable - allocated)),
    paymentState: chargePaymentState(payable, allocated),
    invoiceId: c.invoiceId,
    invoiceNumber: c.invoice?.invoiceNumber ?? null,
    status: c.status,
    needsPricing: c.needsPricing,
    needsReview: !!c.sourceRemovedAt,
    voidReason: c.voidReason,
    createdAt: c.createdAt.toISOString(),
  };
}
