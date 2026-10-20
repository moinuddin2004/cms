// Lab billing (lab ERD §6a). Money is always integer paisa.

export type LabInvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partially_paid'
  | 'paid'
  | 'void'
export type LabPaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'wallet'
export type LabLineKind = 'lab_item' | 'lab_charge' | 'manual'

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PatientRef {
  id: string
  fullName: string
  patientNumber: string
}

export interface LabInvoiceRow {
  id: string
  invoiceNo: string | null
  status: LabInvoiceStatus
  overdue: boolean
  patient: PatientRef
  order: { id: string; orderNo: string | null } | null
  issuedOn: string | null
  dueOn: string | null
  subtotalPaisa: number
  discountPaisa: number
  taxPaisa: number
  totalPaisa: number
  creditedPaisa: number
  paidPaisa: number
  balancePaisa: number
  createdAt: string
  version: number
}

export interface PatientBillingSummary {
  patientId: string
  invoicedPaisa: number
  creditedPaisa: number
  paidPaisa: number
  receivablePaisa: number
  collectedPaisa: number
  refundedPaisa: number
  advancePaisa: number
}

export interface LabInvoiceLine {
  id: string
  lineNo: number
  kind: LabLineKind
  labOrderItemId: string | null
  chargeRequestId: string | null
  description: string
  quantity: number
  unitPricePaisa: number
  discountPaisa: number
  taxRateBp: number
  taxPaisa: number
  lineTotalPaisa: number
  doctor: { id: string; fullName: string } | null
}

export interface LabAllocation {
  id: string
  paymentId: string
  receiptNo: string
  method: LabPaymentMethod
  receivedAt: string
  paymentStatus: 'posted' | 'reversed'
  amountPaisa: number
  createdAt: string
  reversedAt: string | null
  releaseReason: 'payment_reversed' | 'credit_note' | null
}

export interface LabCreditNote {
  id: string
  creditNoteNo: string
  amountPaisa: number
  releasedPaisa: number
  refundedPaisa: number
  status: 'issued' | 'applied' | 'refunded'
  reason: string
  createdAt: string
}

export interface HistoryEntry {
  id: string
  kind: 'audit' | 'status'
  action: string
  fromState: string | null
  toState: string | null
  reason: string | null
  actor: { id: string; name: string | null } | null
  createdAt: string
}

export interface LabInvoiceDetail extends LabInvoiceRow {
  notes: string | null
  voidReason: string | null
  voidedAt: string | null
  issuedAt: string | null
  lines: LabInvoiceLine[]
  allocations: LabAllocation[]
  creditNotes: LabCreditNote[]
  refunds: Array<{
    id: string
    refundNo: string
    amountPaisa: number
    method: LabPaymentMethod
    refundedAt: string
    creditNoteId: string | null
  }>
  patientSummary: PatientBillingSummary
  history: HistoryEntry[]
}

export interface LabPaymentRow {
  id: string
  receiptNo: string
  patient: PatientRef
  amountPaisa: number
  method: LabPaymentMethod
  reference: string | null
  notes: string | null
  receivedAt: string
  receivedOn: string
  receivedBy: string | null
  status: 'posted' | 'reversed'
  isReversal: boolean
  reversalOf: { id: string; receiptNo: string } | null
  reversedBy: { id: string; receiptNo: string } | null
  reason: string | null
  allocatedPaisa: number
  refundedPaisa: number
  advancePaisa: number
}

export interface LabPaymentDetail extends LabPaymentRow {
  allocations: Array<{
    id: string
    invoiceId: string
    invoiceNo: string | null
    amountPaisa: number
    createdAt: string
    reversedAt: string | null
    releaseReason: string | null
  }>
  refunds: Array<{
    id: string
    refundNo: string
    amountPaisa: number
    refundedAt: string
  }>
}

export interface OrderBilling {
  orderId: string
  patientId: string
  invoices: LabInvoiceRow[]
  unbilledItems: Array<{
    id: string
    description: string
    quantity: number
    patientLinePricePaisa: number
    status: string
  }>
  unbilledCharges: Array<{
    id: string
    kind: string
    reason: string
    amountPaisa: number
  }>
  totals: {
    billedPaisa: number
    creditedPaisa: number
    paidPaisa: number
    balancePaisa: number
  }
  patientSummary: PatientBillingSummary
}

export interface InvoiceLineInput {
  kind: LabLineKind
  itemId?: string
  chargeRequestId?: string
  description?: string
  quantity?: number
  unitPricePaisa?: number
  discountPaisa?: number
}

export interface InvoiceInput {
  orderId?: string
  patientId?: string
  lines?: InvoiceLineInput[]
  discountPaisa?: number
  taxRateBp?: number
  notes?: string
  issue?: boolean
}

export interface PaymentInput {
  patientId: string
  amountPaisa: number
  method: LabPaymentMethod
  reference?: string
  notes?: string
  allocations?: Array<{ invoiceId: string; amountPaisa: number }>
  autoAllocate?: boolean
}

export interface InvoiceParams {
  page: number
  limit: number
  search?: string
  status?: LabInvoiceStatus | 'overdue'
  patientId?: string
  orderId?: string
  from?: string
  to?: string
}

export interface PaymentParams {
  page: number
  limit: number
  search?: string
  status?: 'posted' | 'reversed'
  method?: LabPaymentMethod
  patientId?: string
  from?: string
  to?: string
}

export const METHOD_LABEL: Record<LabPaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  wallet: 'Wallet',
}

export const STATUS_LABEL: Record<LabInvoiceStatus, string> = {
  draft: 'Estimate',
  issued: 'Unpaid',
  partially_paid: 'Partly paid',
  paid: 'Paid',
  void: 'Void',
}
