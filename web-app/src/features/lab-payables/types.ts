/** Lab payables (lab ERD §6b). All money is integer minor units. */

export type BillStatus =
  'draft' | 'approved' | 'partially_paid' | 'paid' | 'void'
export type BillLineKind =
  'service' | 'rush' | 'shipping' | 'material' | 'remake' | 'other'
export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'other'
export type StatementStatus =
  'uploaded' | 'reconciling' | 'reconciled' | 'disputed'
export type MatchStatus =
  'matched' | 'amount_mismatch' | 'missing_in_system' | 'missing_in_statement'

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface VendorBill {
  id: string
  billNo: string
  vendorInvoiceNo: string | null
  labId: string
  labName: string | null
  labOrderId: string | null
  orderNo: string | null
  statementId: string | null
  status: BillStatus
  billDate: string
  dueOn: string | null
  subtotalMinor: number
  taxBp: number
  taxMinor: number
  totalMinor: number
  paidMinor: number
  balanceMinor: number
  currency: string
  approvedAt: string | null
  voidedAt: string | null
  voidReason: string | null
  createdAt: string
  version: number
  notes?: string | null
  clinicName?: string | null
}

export interface BillLine {
  id: string
  lineKind: BillLineKind
  labOrderId: string | null
  orderItemId: string | null
  chargeRequestId: string | null
  remakeRequestId: string | null
  description: string
  quantity: number
  unitCostMinor: number
  lineTotalMinor: number
  isManual: boolean
}

export interface Allocation {
  id: string
  vendorPaymentId: string
  paymentNo: string | null
  vendorBillId: string
  billNo: string | null
  amountMinor: number
  reversedAt: string | null
  createdAt: string
}

export interface VendorBillDetail extends VendorBill {
  lines: BillLine[]
  allocations: Allocation[]
}

export interface VendorPayment {
  id: string
  paymentNo: string
  labId: string
  labName: string | null
  amountMinor: number
  allocatedMinor: number
  unallocatedMinor: number
  method: PaymentMethod
  reference: string | null
  paidOn: string
  paidAt: string
  status: 'posted' | 'reversed'
  reversedAt: string | null
  reversalReason?: string | null
  version: number
  clinicName?: string | null
  allocations?: Allocation[]
}

export interface LabStatement {
  id: string
  labId: string
  labName: string | null
  periodStart: string
  periodEnd: string
  statementRef: string | null
  totalMinor: number
  status: StatementStatus
  counts: Partial<Record<MatchStatus, number>> | null
  createdAt: string
  version: number
  notes?: string | null
  clinicName?: string | null
}

export interface StatementLine {
  id: string
  labReference: string | null
  lineDate: string | null
  description: string | null
  amountMinor: number
  systemAmountMinor: number | null
  matchedBillId: string | null
  matchedBillLineId: string | null
  matchStatus: MatchStatus
  billNo?: string | null
  orderNo?: string | null
  billStatus?: BillStatus | null
}

export interface LabStatementDetail extends LabStatement {
  lines: StatementLine[]
}

export interface BillParams {
  page?: number
  limit?: number
  status?: string
  labId?: string
  labOrderId?: string
  search?: string
  from?: string
  to?: string
  open?: 'true' | 'false'
}

export type AgingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus'
export interface AgingReport {
  asOf: string
  labs: Array<{
    labId: string
    labName: string
    buckets: Record<AgingBucket, number>
    totalMinor: number
    bills: number
  }>
  totals: { buckets: Record<AgingBucket, number>; totalMinor: number }
}

export interface MonthlyCostReport {
  year: number
  labs: Array<{
    labId: string
    labName: string
    months: number[]
    totalMinor: number
  }>
  totals: { months: number[]; totalMinor: number }
}

export interface CaseProfitRow {
  orderId: string
  orderNo: string
  status: string
  submittedAt: string
  labName: string
  patientName: string | null
  patientPriceMinor: number
  labCostMinor: number
  billedLabCostMinor: number
  expensesMinor: number
  /** Issued lab invoices net of credit notes; null while nothing is invoiced. */
  invoicedMinor: number | null
  collectedMinor: number
  commissionMinor: number
  profitMinor: number
}

export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  draft: 'Draft',
  approved: 'Approved',
  partially_paid: 'Partly paid',
  paid: 'Paid',
  void: 'Void',
}

export const LINE_KIND_LABEL: Record<BillLineKind, string> = {
  service: 'Work',
  rush: 'Rush',
  shipping: 'Shipping',
  material: 'Material',
  remake: 'Remake',
  other: 'Other',
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  other: 'Other',
}

export const STATEMENT_STATUS_LABEL: Record<StatementStatus, string> = {
  uploaded: 'Uploaded',
  reconciling: 'Needs review',
  reconciled: 'Reconciled',
  disputed: 'Disputed',
}

export const MATCH_LABEL: Record<MatchStatus, string> = {
  matched: 'Matched',
  amount_mismatch: 'Amount differs',
  missing_in_system: 'Not in our bills',
  missing_in_statement: 'Not on statement',
}

export const AGING_LABEL: Record<AgingBucket, string> = {
  current: 'Not due',
  d1_30: '1–30 days',
  d31_60: '31–60 days',
  d61_90: '61–90 days',
  d90_plus: '90+ days',
}
