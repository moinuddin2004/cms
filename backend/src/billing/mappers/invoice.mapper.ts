import { fromPaisa } from '../common/money';
import { chargeSnapshot } from '../charges/charge-math';
import { Charge } from '../entities/charge.entity';
import { Invoice } from '../entities/invoice.entity';
import {
  invoicePaymentStatus,
  invoiceRefundStatus,
  refundablePaisa,
} from '../invoices/invoice-status';
import { InvoiceResponse, PatientRef } from './billing-response.types';

/** Header fields of an invoice; detail lists are attached by the queries. */
export function toInvoiceResponse(
  inv: Invoice,
  today: string,
  patient: PatientRef,
  issuedByName: string | null,
): InvoiceResponse {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    paymentStatus: invoicePaymentStatus(inv, today),
    refundStatus: invoiceRefundStatus(inv),
    revision: inv.revision,
    patient,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    subtotal: inv.subtotal,
    discountTotal: inv.discountTotal,
    totalAmount: inv.totalAmount,
    paidAmount: inv.paidAmount,
    balanceDue: inv.balanceDue,
    releasedAmount: inv.releasedAmount,
    refundedAmount: inv.refundedAmount,
    refundableAmount: fromPaisa(refundablePaisa(inv)),
    notes: inv.notes,
    issuedByName,
    cancelReason: inv.cancelReason,
    cancelledAt: inv.cancelledAt?.toISOString() ?? null,
  };
}

/** Full snapshot stored on ISSUED / EDITED audit rows (revisions, 6.7). */
export function invoiceSnapshot(
  inv: Invoice,
  charges: Charge[],
): Record<string, unknown> {
  const header: Record<string, unknown> = { ...inv };
  delete header.patient;
  delete header.charges;
  return {
    invoice: header,
    charges: charges.filter((c) => c.invoiceId === inv.id).map(chargeSnapshot),
  };
}
