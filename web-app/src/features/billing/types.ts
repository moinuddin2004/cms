// ─── Enums (mirror backend src/billing/enums/billing.enums.ts) ──────

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  ONLINE = 'ONLINE',
  INSURANCE = 'INSURANCE',
  CHEQUE = 'CHEQUE',
  CREDIT_PACKAGE = 'CREDIT_PACKAGE',
}

export enum ExpenseCategory {
  RENT = 'RENT',
  UTILITIES = 'UTILITIES',
  SUPPLIES = 'SUPPLIES',
  SALARY = 'SALARY',
  EQUIPMENT = 'EQUIPMENT',
  MARKETING = 'MARKETING',
  MAINTENANCE = 'MAINTENANCE',
  OTHER = 'OTHER',
}

export enum CreditStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  EXHAUSTED = 'EXHAUSTED',
}

// Payment methods that require a reference number in the UI.
export const REFERENCE_METHODS: PaymentMethod[] = [
  PaymentMethod.CARD,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.CHEQUE,
  PaymentMethod.ONLINE,
]

// ─── Entities ───────────────────────────────────────────────────────

export interface InvoiceItem {
  id: string
  invoiceId: string
  treatmentPlanItemId: string | null
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  sortOrder: number
}

export interface Payment {
  id: string
  invoiceId: string
  patientId: string
  receivedBy: string | null
  receiver?: { id: string; fullName?: string } | null
  amount: number
  paymentMethod: PaymentMethod
  referenceNumber: string | null
  paymentDate: string
  notes: string | null
  createdAt: string
  invoice?: Pick<Invoice, 'id' | 'invoiceNumber'>
}

export interface Invoice {
  id: string
  invoiceNumber: string
  organizationId: string
  locationId: string
  patientId: string
  patient?: { id: string; fullName?: string; phone?: string; email?: string }
  treatmentPlanId: string | null
  createdBy: string | null
  creator?: { id: string; fullName?: string } | null
  subtotal: number
  discountType: DiscountType | null
  discountValue: number
  discountAmount: number
  couponId: string | null
  coupon?: Coupon | null
  taxRate: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  balanceDue: number
  status: InvoiceStatus
  issuedDate: string | null
  dueDate: string | null
  paidDate: string | null
  notes: string | null
  items?: InvoiceItem[]
  payments?: Payment[]
  createdAt: string
  updatedAt: string
}

export interface InvoiceStats {
  totalInvoices: number
  totalRevenue: number
  outstandingAmount: number
  overdueCount: number
}

export interface Coupon {
  id: string
  organizationId: string
  code: string
  name: string
  discountType: DiscountType
  discountValue: number
  maxDiscountAmount: number | null
  minInvoiceAmount: number | null
  validFrom: string
  validUntil: string
  maxUses: number | null
  usedCount: number
  isActive: boolean
  createdAt: string
}

export interface Expense {
  id: string
  organizationId: string
  locationId: string
  category: ExpenseCategory
  description: string
  amount: number
  expenseDate: string
  paymentMethod: PaymentMethod
  referenceNumber: string | null
  receiptUrl: string | null
  recordedBy: string | null
  recorder?: { id: string; fullName?: string } | null
  notes: string | null
  createdAt: string
}

export interface CreditPackage {
  id: string
  organizationId: string
  name: string
  description: string | null
  totalCredits: number
  price: number
  validityDays: number | null
  isActive: boolean
  createdAt: string
}

export interface PatientCredit {
  id: string
  patientId: string
  creditPackageId: string | null
  creditPackage?: CreditPackage | null
  totalAmount: number
  usedAmount: number
  remainingAmount: number
  purchaseDate: string
  expiryDate: string | null
  status: CreditStatus
  createdAt: string
}

// ─── Summaries ──────────────────────────────────────────────────────

export interface DailySummary {
  totalCollections: number
  invoicesGenerated: number
  paymentMethodBreakdown: Record<string, number>
  outstandingAmount: number
  overdueCount: number
}

export interface MonthlySummary {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  invoiceCount: number
  paidInvoiceCount: number
  overdueInvoiceCount: number
  avgInvoiceValue: number
  revenueByDay: Array<{ date: string; amount: number }>
  expensesByCategory: Array<{ category: string; amount: number }>
  paymentMethodDistribution: Array<{ method: string; amount: number }>
  topProcedures: Array<{ name: string; count: number; revenue: number }>
}

export interface RevenueTrendPoint {
  month: string
  revenue: number
  expenses: number
}

export interface ExpenseSummary {
  byCategory: Array<{ category: string; total: number }>
  grandTotal: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── Request payload shapes ─────────────────────────────────────────

export interface CreateInvoiceItemInput {
  description: string
  quantity: number
  unitPrice: number
  treatmentPlanItemId?: string
}

export interface CreateInvoiceInput {
  patientId: string
  treatmentPlanId?: string
  dueDate?: string
  notes?: string
  items?: CreateInvoiceItemInput[]
}

export interface RecordPaymentInput {
  amount: number
  paymentMethod: PaymentMethod
  referenceNumber?: string
  paymentDate?: string
  notes?: string
}

export interface InvoiceFilters {
  status?: InvoiceStatus
  patientId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export const STATUS_BADGE: Record<InvoiceStatus, string> = {
  [InvoiceStatus.DRAFT]: 'bg-muted text-muted-foreground',
  [InvoiceStatus.PENDING]: 'bg-yellow-100 text-yellow-700',
  [InvoiceStatus.PARTIALLY_PAID]: 'bg-blue-100 text-blue-700',
  [InvoiceStatus.PAID]: 'bg-green-100 text-green-700',
  [InvoiceStatus.OVERDUE]: 'bg-red-100 text-red-700',
  [InvoiceStatus.CANCELLED]: 'bg-muted text-muted-foreground',
  [InvoiceStatus.REFUNDED]: 'bg-purple-100 text-purple-700',
}
