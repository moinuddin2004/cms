// ─── Enums (mirror backend src/billing/enums/billing.enums.ts) ──────

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

export interface InvoiceStats {
  totalInvoices: number
  totalRevenue: number
  outstandingAmount: number
  overdueCount: number
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
