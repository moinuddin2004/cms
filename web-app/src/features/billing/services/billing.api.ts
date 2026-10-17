import api from '@/lib/api'
import type {
  InvoiceStats,
  Expense,
  ExpenseSummary,
  CreditPackage,
  PatientCredit,
  DailySummary,
  MonthlySummary,
  RevenueTrendPoint,
  PaginatedResponse,
  ExpenseCategory,
  PaymentMethod,
} from '../types'
import type { InvoiceStatsV2 } from '../types/billing.types'

// ─── Invoice stats (dashboard) ─────────────────────────────────────

/** Dashboard rollup, derived from billing v2 `/invoices/stats`. */
export async function fetchInvoiceStats(): Promise<InvoiceStats> {
  const { data } = await api.get('/invoices/stats')
  const s = data.data as InvoiceStatsV2
  const count = Object.entries(s.counts)
    .filter(([k]) => k !== 'REFUNDED')
    .reduce((a, [, n]) => a + n, 0)
  return {
    totalInvoices: count,
    totalRevenue: s.totals.collected,
    outstandingAmount: s.totals.outstanding,
    overdueCount: s.counts.OVERDUE,
  }
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
