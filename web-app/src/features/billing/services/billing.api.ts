import api from '@/lib/api'
import type {
  Invoice,
  InvoiceStats,
  InvoiceFilters,
  CreateInvoiceInput,
  RecordPaymentInput,
  Payment,
  Coupon,
  Expense,
  ExpenseSummary,
  CreditPackage,
  PatientCredit,
  DailySummary,
  MonthlySummary,
  RevenueTrendPoint,
  PaginatedResponse,
  DiscountType,
  ExpenseCategory,
  PaymentMethod,
} from '../types'

// ─── Invoices ───────────────────────────────────────────────────────

export async function fetchInvoices(
  params: InvoiceFilters,
): Promise<PaginatedResponse<Invoice>> {
  const { data } = await api.get('/invoices', { params })
  return data.data
}

export async function fetchInvoice(id: string): Promise<Invoice> {
  const { data } = await api.get(`/invoices/${id}`)
  return data.data
}

export async function fetchInvoiceStats(): Promise<InvoiceStats> {
  const { data } = await api.get('/invoices/stats')
  return data.data
}

export async function createInvoice(
  payload: CreateInvoiceInput,
): Promise<Invoice> {
  const { data } = await api.post('/invoices', payload)
  return data.data
}

export async function updateInvoice(
  id: string,
  payload: {
    dueDate?: string
    notes?: string
    discountType?: DiscountType
    discountValue?: number
    taxRate?: number
  },
): Promise<Invoice> {
  const { data } = await api.patch(`/invoices/${id}`, payload)
  return data.data
}

export async function updateInvoiceStatus(
  id: string,
  status: string,
): Promise<Invoice> {
  const { data } = await api.patch(`/invoices/${id}/status`, { status })
  return data.data
}

export async function addInvoiceItem(
  invoiceId: string,
  payload: { description: string; quantity: number; unitPrice: number },
): Promise<Invoice> {
  const { data } = await api.post(`/invoices/${invoiceId}/items`, payload)
  return data.data
}

export async function removeInvoiceItem(
  invoiceId: string,
  itemId: string,
): Promise<Invoice> {
  const { data } = await api.delete(`/invoices/${invoiceId}/items/${itemId}`)
  return data.data
}

export async function generateInvoiceFromTreatmentPlan(
  planId: string,
): Promise<Invoice> {
  const { data } = await api.post(`/invoices/from-treatment-plan/${planId}`)
  return data.data
}

export async function applyCoupon(
  invoiceId: string,
  code: string,
): Promise<Invoice> {
  const { data } = await api.post(`/invoices/${invoiceId}/apply-coupon`, {
    code,
  })
  return data.data
}

export async function removeCoupon(invoiceId: string): Promise<Invoice> {
  const { data } = await api.delete(`/invoices/${invoiceId}/remove-coupon`)
  return data.data
}

export async function fetchPaymentLink(
  invoiceId: string,
): Promise<{ url: string; provider: string }> {
  const { data } = await api.post(`/invoices/${invoiceId}/payment-link`)
  return data.data
}

// ─── Payments ───────────────────────────────────────────────────────

export async function recordPayment(
  invoiceId: string,
  payload: RecordPaymentInput,
): Promise<Payment> {
  const { data } = await api.post(`/invoices/${invoiceId}/payments`, payload)
  return data.data
}

export async function fetchInvoicePayments(
  invoiceId: string,
): Promise<Payment[]> {
  const { data } = await api.get(`/invoices/${invoiceId}/payments`)
  return data.data
}

export async function downloadReceiptPdf(invoiceId: string): Promise<Blob> {
  const res = await api.get(`/invoices/${invoiceId}/receipt-pdf`, {
    responseType: 'blob',
  })
  return res.data
}

// ─── Coupons ────────────────────────────────────────────────────────

export async function fetchCoupons(): Promise<Coupon[]> {
  const { data } = await api.get('/coupons')
  return data.data
}

export async function createCoupon(payload: {
  code: string
  name: string
  discountType: DiscountType
  discountValue: number
  maxDiscountAmount?: number
  minInvoiceAmount?: number
  validFrom: string
  validUntil: string
  maxUses?: number
}): Promise<Coupon> {
  const { data } = await api.post('/coupons', payload)
  return data.data
}

export async function updateCoupon(
  id: string,
  payload: Partial<Coupon>,
): Promise<Coupon> {
  const { data } = await api.patch(`/coupons/${id}`, payload)
  return data.data
}

export async function deactivateCoupon(id: string): Promise<Coupon> {
  const { data } = await api.delete(`/coupons/${id}`)
  return data.data
}

// ─── Expenses ───────────────────────────────────────────────────────

export async function fetchExpenses(params: {
  category?: ExpenseCategory
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}): Promise<PaginatedResponse<Expense>> {
  const { data } = await api.get('/expenses', { params })
  return data.data
}

export async function createExpense(payload: {
  category: ExpenseCategory
  description: string
  amount: number
  expenseDate: string
  paymentMethod: PaymentMethod
  referenceNumber?: string
  receiptUrl?: string
  notes?: string
}): Promise<Expense> {
  const { data } = await api.post('/expenses', payload)
  return data.data
}

export async function updateExpense(
  id: string,
  payload: Partial<Expense>,
): Promise<Expense> {
  const { data } = await api.patch(`/expenses/${id}`, payload)
  return data.data
}

export async function deleteExpense(id: string): Promise<{ id: string }> {
  const { data } = await api.delete(`/expenses/${id}`)
  return data.data
}

export async function fetchExpenseSummary(
  month: number,
  year: number,
): Promise<ExpenseSummary> {
  const { data } = await api.get('/expenses/summary', {
    params: { month, year },
  })
  return data.data
}

// ─── Financial summary ──────────────────────────────────────────────

export async function fetchDailyFinancialSummary(
  date: string,
): Promise<DailySummary> {
  const { data } = await api.get('/financial-summary/daily', {
    params: { date },
  })
  return data.data
}

export async function fetchMonthlyFinancialSummary(
  month: number,
  year: number,
): Promise<MonthlySummary> {
  const { data } = await api.get('/financial-summary/monthly', {
    params: { month, year },
  })
  return data.data
}

export async function fetchRevenueTrend(
  months: number,
): Promise<RevenueTrendPoint[]> {
  const { data } = await api.get('/financial-summary/trend', {
    params: { months },
  })
  return data.data
}

// ─── Credit packages ────────────────────────────────────────────────

export async function fetchCreditPackages(): Promise<CreditPackage[]> {
  const { data } = await api.get('/credit-packages')
  return data.data
}

export async function createCreditPackage(payload: {
  name: string
  description?: string
  totalCredits: number
  price: number
  validityDays?: number
}): Promise<CreditPackage> {
  const { data } = await api.post('/credit-packages', payload)
  return data.data
}

export async function fetchPatientCredits(
  patientId: string,
): Promise<PatientCredit[]> {
  const { data } = await api.get(`/patients/${patientId}/credits`)
  return data.data
}

export async function purchaseCredit(
  patientId: string,
  creditPackageId: string,
): Promise<PatientCredit> {
  const { data } = await api.post(`/patients/${patientId}/credits`, {
    creditPackageId,
  })
  return data.data
}

export async function useCredit(
  patientId: string,
  creditId: string,
  amount: number,
): Promise<PatientCredit> {
  const { data } = await api.post(
    `/patients/${patientId}/credits/${creditId}/use`,
    { amount },
  )
  return data.data
}
