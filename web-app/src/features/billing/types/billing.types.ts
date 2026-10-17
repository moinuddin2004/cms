// Response / request shapes of billing v2 (backend plan §7.7).
// Money is always rupees (number); dates are clinic `YYYY-MM-DD` strings.

export type ServiceKind = 'CONSULTATION' | 'PROCEDURE' | 'OTHER'
export type ChargeSource =
  | 'CONSULTATION'
  | 'TREATMENT'
  | 'TREATMENT_PLAN'
  | 'MANUAL'
export type ChargeStatus = 'ACTIVE' | 'VOID'
export type DiscountKind = 'PERCENTAGE' | 'FIXED'
export type DiscountAppliesTo = 'ALL' | 'SERVICE_KINDS' | 'SERVICES'
export type InvoiceStatus = 'ISSUED' | 'CANCELLED'
export type InvoicePaymentStatus =
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
export type InvoiceRefundStatus =
  | 'NONE'
  | 'PARTIALLY_REFUNDED'
  | 'FULLY_REFUNDED'
export type InvoiceListStatus = InvoicePaymentStatus | 'REFUNDED' | 'CANCELLED'
export type PaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'ONLINE_WALLET'
export type PrintFormat = 'A4' | 'THERMAL_80'
export type AllocationMode = 'AUTO' | 'MANUAL'
export type ChargePaymentState = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PatientRef {
  id: string
  name: string
  phone: string | null
  mrn: string | null
}

// ─── Configuration ──────────────────────────────────────────────────

export interface CatalogService {
  id: string
  name: string
  code: string | null
  kind: ServiceKind
  defaultPrice: number
  isActive: boolean
  sortOrder: number
}

export interface ServicePriceOverride {
  id: string
  serviceId: string
  serviceName: string
  doctorId: string | null
  doctorName: string | null
  price: number
}

export interface ResolvedPrice {
  serviceId: string
  unitPrice: number
  description: string
  serviceKind: ServiceKind
  level: 'DOCTOR' | 'LOCATION' | 'DEFAULT'
}

export interface BillingSettings {
  locationId: string
  locationName: string
  documentCode: string | null
  documentCodeLocked: boolean
  dueDays: number
  invoicePrintFormat: PrintFormat
  receiptPrintFormat: PrintFormat
  showLogo: boolean
  showPreviousBalance: boolean
  showOutstandingAtCheckIn: boolean
  footerNote: string | null
  defaultConsultationServiceId: string | null
  defaultPaymentAccountId: string | null
  cashVarianceAlertAmount: number
}

export interface PaymentAccount {
  id: string
  name: string
  method: PaymentMethod
  bankName: string | null
  accountTitle: string | null
  accountNumber: string | null
  requiresReference: boolean
  countedInCashClose: boolean
  isActive: boolean
  sortOrder: number
}

export interface DiscountType {
  id: string
  name: string
  code: string | null
  kind: DiscountKind
  value: number
  maxAmount: number | null
  appliesTo: DiscountAppliesTo
  serviceKinds: ServiceKind[] | null
  serviceIds: string[] | null
  receptionEditable: boolean
  minValue: number | null
  maxValue: number | null
  requiresNote: boolean
  validFrom: string | null
  validTo: string | null
  isActive: boolean
}

// ─── Charges & invoices ─────────────────────────────────────────────

export interface ChargeDiscount {
  typeId: string | null
  name: string
  kind: DiscountKind
  value: number
  amount: number
  note: string | null
  isCustom: boolean
}

export interface Charge {
  id: string
  patientId: string
  source: ChargeSource
  serviceId: string | null
  description: string
  doctorId: string | null
  doctorName: string | null
  chargeDate: string
  quantity: number
  unitPrice: number
  grossAmount: number
  discount: ChargeDiscount | null
  netAmount: number
  allocatedAmount: number
  balance: number
  paymentState: ChargePaymentState
  invoiceId: string | null
  invoiceNumber: string | null
  status: ChargeStatus
  needsPricing: boolean
  needsReview: boolean
  voidReason: string | null
  createdAt: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  status: InvoiceStatus
  paymentStatus: InvoicePaymentStatus | null
  refundStatus: InvoiceRefundStatus
  revision: number
  patient: PatientRef
  issueDate: string
  dueDate: string
  subtotal: number
  discountTotal: number
  totalAmount: number
  paidAmount: number
  balanceDue: number
  releasedAmount: number
  refundedAmount: number
  refundableAmount: number
  notes: string | null
  issuedByName: string | null
  cancelReason: string | null
  cancelledAt: string | null
  charges?: Charge[]
  payments?: Array<{
    paymentId: string
    receiptNumber: string
    paymentDate: string
    method: PaymentMethod
    paymentAccountName: string
    amountOnThisInvoice: number
  }>
  refunds?: Array<{
    refundId: string
    refundNumber: string
    refundDate: string
    amount: number
    method: PaymentMethod
    paymentAccountName: string
    reason: string
    refundedByName: string | null
  }>
  revisions?: Array<{
    revision: number
    editedAt: string
    editedByName: string | null
    reason: string | null
  }>
}

export interface InvoiceStatsV2 {
  counts: Record<InvoiceListStatus, number>
  totals: {
    invoiced: number
    collected: number
    outstanding: number
    overdue: number
    refunded: number
  }
}

export type InvoiceEditOp =
  | { op: 'updateQuantity'; chargeId: string; quantity: number }
  | { op: 'setUnitPrice'; chargeId: string; unitPrice: number }
  | {
      op: 'setDiscount'
      chargeId: string
      discountTypeId?: string
      kind?: DiscountKind
      value?: number
      note?: string
    }
  | { op: 'removeDiscount'; chargeId: string }
  | { op: 'voidCharge'; chargeId: string }
  | { op: 'addCharges'; chargeIds: string[] }
  | {
      op: 'addManualCharge'
      serviceId?: string
      description?: string
      quantity?: number
      unitPrice?: number
    }

export interface EditInvoicePreview {
  revision: number
  oldTotal: number
  newTotal: number
  delta: number
  newBalanceDue: number
  releasedToAdvance: number
  releases: Array<{ paymentId: string; receiptNumber: string; amount: number }>
  charges: Charge[]
}

// ─── Payments & refunds ─────────────────────────────────────────────

export interface Payment {
  id: string
  receiptNumber: string
  patient: PatientRef
  amount: number
  method: PaymentMethod
  paymentAccountId: string
  paymentAccountName: string
  referenceNumber: string | null
  paymentDate: string
  receivedAt: string
  receivedByName: string | null
  notes: string | null
  allocatedAmount: number
  refundedAmount: number
  advance: number
  refundStatus: 'NONE' | 'PARTIAL' | 'FULL'
}

export interface PaymentDetail extends Payment {
  allocations: Array<{
    id: string
    chargeId: string
    chargeDescription: string
    invoiceId: string
    invoiceNumber: string
    amount: number
    reason: string
    note: string | null
    createdAt: string
  }>
  refunds: Refund[]
}

export interface Refund {
  id: string
  refundNumber: string
  patient: PatientRef
  amount: number
  method: PaymentMethod
  paymentAccountName: string
  referenceNumber: string | null
  reason: string
  refundDate: string
  refundedAt: string
  refundedByName: string | null
  invoiceId: string | null
  invoiceNumber: string | null
}

export interface ChargeSelection {
  chargeId: string
  amount?: number
}

export interface PaymentPreviewInput {
  patientId: string
  amount: number
  paymentAccountId?: string
  applyAdvance: boolean
  mode: AllocationMode
  selections: ChargeSelection[]
}

export interface CollectPaymentInput extends PaymentPreviewInput {
  paymentAccountId: string
  referenceNumber?: string
  notes?: string
  clientRequestId: string
}

export interface PaymentPreview {
  totalSelectedBalance: number
  advanceAvailable: number
  advanceUsed: number
  payingNow: number
  toAdvance: number
  amountToClearSelected: number
  invoiceWillBeIssued: boolean
  willInvoice: Array<{
    chargeId: string
    description: string
    netAmount: number
  }>
  willInvoiceTotal: number
  lines: Array<{
    chargeId: string
    description: string
    invoiceNumber: string | null
    source: 'NEW' | 'ADVANCE'
    amount: number
  }>
  blockers: Array<{
    chargeId: string
    description: string
    reason: 'NEEDS_PRICING'
  }>
}

export interface CollectResult {
  payment: Payment | null
  invoiceId: string | null
  invoiceNumber: string | null
  allocations: Array<{
    chargeId: string
    invoiceNumber: string | null
    source: 'NEW' | 'ADVANCE'
    amount: number
  }>
  summary: PatientBillingSummary
}

export interface RefundInput {
  amount: number
  paymentAccountId: string
  referenceNumber?: string
  reason: string
  clientRequestId: string
}

export interface DailyCollection {
  date: string
  accounts: Array<{
    paymentAccountId: string
    paymentAccountName: string
    method: PaymentMethod
    paymentsTotal: number
    paymentCount: number
    refundsTotal: number
    refundCount: number
    net: number
  }>
  totals: { payments: number; refunds: number; net: number }
}

// ─── Patient billing, reports ───────────────────────────────────────

export interface PatientBillingSummary {
  patientId: string
  unbilledTotal: number
  invoicedOutstanding: number
  overdueAmount: number
  advance: number
  netPosition: number
  ledgerBalance: number
  needsReviewCount: number
  needsPricingCount: number
}

export interface StatementRow {
  id: string
  entryDate: string
  type:
    | 'INVOICE_ISSUED'
    | 'INVOICE_ADJUSTED'
    | 'INVOICE_CANCELLED'
    | 'PAYMENT'
    | 'REFUND'
  description: string
  debit: number
  credit: number
  balance: number
  invoiceId: string | null
  paymentId: string | null
  refundId: string | null
}

export interface Statement {
  from: string | null
  to: string | null
  openingBalance: number
  rows: StatementRow[]
  closingBalance: number
  advance: number
}

export interface OutstandingRow {
  patientId: string
  outstanding: number
  advance: number
  hasOverdue: boolean
}

export interface ReadyToBillRow {
  patientId: string
  patientName: string
  phone: string | null
  mrn: string | null
  chargeCount: number
  unbilledTotal: number
  needsPricing: boolean
  lastChargeAt: string
}

export interface CashCloseLine {
  paymentAccountId: string
  paymentAccountName: string
  countedInCashClose?: boolean
  paymentsTotal: number
  paymentCount: number
  refundsTotal: number
  refundCount: number
  expected: number
  counted: number | null
  variance: number
}

export interface CashClosePreview {
  periodStart: string | null
  periodEnd: string
  lines: CashCloseLine[]
  totalExpected: number
  totalCounted: number
  totalVariance: number
}

export interface CashClose {
  id: string
  periodStart: string
  periodEnd: string
  businessDate: string
  totalExpected: number
  totalCounted: number
  totalVariance: number
  note: string | null
  closedByName: string | null
  flagged: boolean
  createdAt: string
  lines?: CashCloseLine[]
}

export interface DoctorRevenueReport {
  rows: Array<{
    doctorId: string | null
    doctorName: string
    billed: number
    discounts: number
    collected: number
  }>
  totals: { billed: number; discounts: number; collected: number }
}

export interface PlanBillingSummary {
  planId: string
  estimate: number
  billed: number
  unbilled: number
  notYetCharged: number
  paid: number
  balance: number
}

export interface ActivityRow {
  id: string
  at: string
  actorId: string
  actorName: string | null
  actorRole: string
  entityType: string
  entityId: string
  action: string
  amount: number | null
  reason: string | null
}

export interface ActivityDayTotal {
  date: string
  actorId: string
  actorName: string | null
  edits: number
  refunds: number
  refundAmount: number
  discounts: number
  discountAmount: number
  cancellations: number
}

export interface BillingActivity {
  feed: Paginated<ActivityRow>
  dayTotals: ActivityDayTotal[]
}
