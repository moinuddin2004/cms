import { VendorPaymentStatus } from '../enums/payables.enums';
import type {
  LabStatement,
  LabStatementLine,
} from '../entities/lab-statement.entity';
import type {
  VendorBill,
  VendorBillLine,
} from '../entities/vendor-bill.entity';
import type {
  VendorPayment,
  VendorPaymentAllocation,
} from '../entities/vendor-payment.entity';

/**
 * Response shapes. Bills only ever hold lab costs, so the same shapes serve
 * the lab portal — minus the clinic's internal notes and journal ids, and
 * never anything from the patient side.
 */
export type Audience = 'clinic' | 'lab';

export interface BillExtras {
  labName?: string | null;
  orderNo?: string | null;
  clinicName?: string | null;
}

export const toBillLine = (l: VendorBillLine) => ({
  id: l.id,
  lineKind: l.lineKind,
  labOrderId: l.labOrderId,
  orderItemId: l.orderItemId,
  chargeRequestId: l.chargeRequestId,
  remakeRequestId: l.remakeRequestId,
  description: l.description,
  quantity: l.quantity,
  unitCostMinor: l.unitCostMinor,
  lineTotalMinor: l.lineTotalMinor,
  isManual: l.isManual,
});

export const toBill = (b: VendorBill, x: BillExtras, audience: Audience) => ({
  id: b.id,
  billNo: b.billNo,
  vendorInvoiceNo: b.vendorInvoiceNo,
  labId: b.labId,
  labName: x.labName ?? null,
  labOrderId: b.labOrderId,
  orderNo: x.orderNo ?? null,
  statementId: b.statementId,
  status: b.status,
  billDate: b.billDate,
  dueOn: b.dueOn,
  subtotalMinor: b.subtotalMinor,
  taxBp: b.taxBp,
  taxMinor: b.taxMinor,
  totalMinor: b.totalMinor,
  paidMinor: b.paidMinor,
  balanceMinor: b.balanceMinor,
  currency: b.currency,
  approvedAt: b.approvedAt,
  voidedAt: b.voidedAt,
  voidReason: b.voidReason,
  createdAt: b.createdAt,
  version: b.version,
  ...(audience === 'clinic'
    ? {
        locationId: b.locationId,
        notes: b.notes,
        approvedBy: b.approvedBy,
        journalId: b.journalId,
      }
    : { clinicName: x.clinicName ?? null }),
});

export const toAllocation = (
  a: VendorPaymentAllocation,
  x: { billNo?: string; paymentNo?: string } = {},
) => ({
  id: a.id,
  vendorPaymentId: a.vendorPaymentId,
  paymentNo: x.paymentNo ?? null,
  vendorBillId: a.vendorBillId,
  billNo: x.billNo ?? null,
  amountMinor: a.amountMinor,
  reversedAt: a.reversedAt,
  createdAt: a.createdAt,
});

export const toPayment = (
  p: VendorPayment,
  x: { labName?: string | null; clinicName?: string | null },
  audience: Audience,
) => ({
  id: p.id,
  paymentNo: p.paymentNo,
  labId: p.labId,
  labName: x.labName ?? null,
  amountMinor: p.amountMinor,
  allocatedMinor: p.allocatedMinor,
  unallocatedMinor:
    p.status === VendorPaymentStatus.POSTED
      ? p.amountMinor - p.allocatedMinor
      : 0,
  method: p.method,
  reference: p.reference,
  paidOn: p.paidOn,
  paidAt: p.paidAt,
  status: p.status,
  reversedAt: p.reversedAt,
  version: p.version,
  ...(audience === 'clinic'
    ? {
        locationId: p.locationId,
        reversalReason: p.reversalReason,
        notes: p.notes,
      }
    : { clinicName: x.clinicName ?? null }),
});

export const toStatementLine = (l: LabStatementLine) => ({
  id: l.id,
  labReference: l.labReference,
  lineDate: l.lineDate,
  description: l.description,
  amountMinor: l.amountMinor,
  systemAmountMinor: l.systemAmountMinor,
  matchedBillId: l.matchedBillId,
  matchedBillLineId: l.matchedBillLineId,
  matchStatus: l.matchStatus,
});

export const toStatement = (
  s: LabStatement,
  x: {
    labName?: string | null;
    clinicName?: string | null;
    counts?: Record<string, number>;
  },
  audience: Audience,
) => ({
  id: s.id,
  labId: s.labId,
  labName: x.labName ?? null,
  periodStart: s.periodStart,
  periodEnd: s.periodEnd,
  statementRef: s.statementRef,
  totalMinor: s.totalMinor,
  status: s.status,
  counts: x.counts ?? null,
  createdAt: s.createdAt,
  version: s.version,
  ...(audience === 'clinic'
    ? { notes: s.notes }
    : { clinicName: x.clinicName ?? null }),
});
