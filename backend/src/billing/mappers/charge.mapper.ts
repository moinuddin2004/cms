import { toPaisa, fromPaisa } from '../common/money';
import { Charge } from '../entities/charge.entity';
import { ChargeStatus } from '../enums/billing.enums';
import { ChargePaymentState, ChargeResponse } from './billing-response.types';

/** Same rule as invoices, without OVERDUE (6.13). */
export function chargePaymentState(
  netPaisa: number,
  allocatedPaisa: number,
): ChargePaymentState {
  if (allocatedPaisa >= netPaisa) return 'PAID';
  return allocatedPaisa > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
}

/** Expects `doctor` and `invoice` relations when names are wanted. */
export function toChargeResponse(c: Charge): ChargeResponse {
  const net = c.status === ChargeStatus.VOID ? 0 : toPaisa(c.netAmount);
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
    allocatedAmount: c.allocatedAmount,
    balance: fromPaisa(Math.max(0, net - allocated)),
    paymentState: chargePaymentState(net, allocated),
    invoiceId: c.invoiceId,
    invoiceNumber: c.invoice?.invoiceNumber ?? null,
    status: c.status,
    needsPricing: c.needsPricing,
    needsReview: !!c.sourceRemovedAt,
    voidReason: c.voidReason,
    createdAt: c.createdAt.toISOString(),
  };
}
