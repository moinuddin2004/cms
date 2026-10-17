import {
  ChargeSource,
  ChargeStatus,
  DiscountKind,
  InvoicePaymentStatus,
  InvoiceRefundStatus,
  InvoiceStatus,
  PaymentMethod,
} from '../enums/billing.enums';

/** Response shapes (7.7). Money = rupees (number), dates = YYYY-MM-DD. */

export type ChargePaymentState = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface ChargeDiscountView {
  typeId: string | null;
  name: string;
  kind: DiscountKind;
  value: number;
  amount: number;
  note: string | null;
  isCustom: boolean;
}

export interface ChargeResponse {
  id: string;
  patientId: string;
  source: ChargeSource;
  serviceId: string | null;
  description: string;
  doctorId: string | null;
  doctorName: string | null;
  chargeDate: string;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  discount: ChargeDiscountView | null;
  netAmount: number;
  allocatedAmount: number;
  balance: number;
  paymentState: ChargePaymentState;
  invoiceId: string | null;
  invoiceNumber: string | null;
  status: ChargeStatus;
  needsPricing: boolean;
  needsReview: boolean;
  voidReason: string | null;
  createdAt: string;
}

export interface PatientRef {
  id: string;
  name: string;
  phone: string | null;
  mrn: string | null;
}

export interface InvoicePaymentLine {
  paymentId: string;
  receiptNumber: string;
  paymentDate: string;
  method: PaymentMethod;
  paymentAccountName: string;
  amountOnThisInvoice: number;
}

export interface InvoiceRefundLine {
  refundId: string;
  refundNumber: string;
  refundDate: string;
  amount: number;
  method: PaymentMethod;
  paymentAccountName: string;
  reason: string;
  refundedByName: string | null;
}

export interface InvoiceRevisionLine {
  revision: number;
  editedAt: string;
  editedByName: string | null;
  reason: string | null;
}

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  paymentStatus: InvoicePaymentStatus | null;
  refundStatus: InvoiceRefundStatus;
  revision: number;
  patient: PatientRef;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  discountTotal: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  releasedAmount: number;
  refundedAmount: number;
  refundableAmount: number;
  notes: string | null;
  issuedByName: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  charges?: ChargeResponse[];
  payments?: InvoicePaymentLine[];
  refunds?: InvoiceRefundLine[];
  revisions?: InvoiceRevisionLine[];
}

export interface PatientBillingSummary {
  patientId: string;
  unbilledTotal: number;
  invoicedOutstanding: number;
  overdueAmount: number;
  advance: number;
  netPosition: number;
  ledgerBalance: number;
  needsReviewCount: number;
  needsPricingCount: number;
}

export interface PaymentResponse {
  id: string;
  receiptNumber: string;
  patient: PatientRef;
  amount: number;
  method: PaymentMethod;
  paymentAccountId: string;
  paymentAccountName: string;
  referenceNumber: string | null;
  paymentDate: string;
  receivedAt: string;
  receivedByName: string | null;
  notes: string | null;
  allocatedAmount: number;
  refundedAmount: number;
  advance: number;
  refundStatus: 'NONE' | 'PARTIAL' | 'FULL';
}

export interface AllocationLine {
  id: string;
  chargeId: string;
  chargeDescription: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  reason: string;
  note: string | null;
  createdAt: string;
}

export interface RefundResponse {
  id: string;
  refundNumber: string;
  patient: PatientRef;
  amount: number;
  method: PaymentMethod;
  paymentAccountName: string;
  referenceNumber: string | null;
  reason: string;
  refundDate: string;
  refundedAt: string;
  refundedByName: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  sources?: Array<{ paymentId: string; receiptNumber: string; amount: number }>;
}
