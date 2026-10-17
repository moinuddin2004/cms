import type { InvoiceFiltersV2 } from './services/billing-v2.api'

/** Single key factory for every billing query (plan §8.4). */
export const billingKeys = {
  all: ['billing'] as const,
  patient: (patientId: string) => ({
    all: ['billing', 'patient', patientId] as const,
    summary: () => ['billing', 'patient', patientId, 'summary'] as const,
    openCharges: () =>
      ['billing', 'patient', patientId, 'open-charges'] as const,
    charges: (state: string) =>
      ['billing', 'patient', patientId, 'charges', state] as const,
    statement: (range: { from?: string; to?: string }) =>
      ['billing', 'patient', patientId, 'statement', range] as const,
    invoices: () => ['billing', 'patient', patientId, 'invoices'] as const,
    payments: () => ['billing', 'patient', patientId, 'payments'] as const,
  }),
  invoices: {
    all: ['billing', 'invoices'] as const,
    list: (filters: InvoiceFiltersV2) =>
      ['billing', 'invoices', 'list', filters] as const,
    stats: (range: object) => ['billing', 'invoices', 'stats', range] as const,
    detail: (id: string) => ['billing', 'invoices', 'detail', id] as const,
  },
  payments: {
    all: ['billing', 'payments'] as const,
    list: (filters: object) =>
      ['billing', 'payments', 'list', filters] as const,
    daily: (date?: string) =>
      ['billing', 'payments', 'daily', date ?? 'today'] as const,
    refunds: (filters: object) =>
      ['billing', 'payments', 'refunds', filters] as const,
  },
  settings: () => ['billing', 'config', 'settings'] as const,
  services: (params: object = {}) =>
    ['billing', 'config', 'services', params] as const,
  prices: (serviceId?: string) =>
    ['billing', 'config', 'prices', serviceId ?? 'all'] as const,
  discountTypes: (usableToday = false) =>
    ['billing', 'config', 'discount-types', usableToday] as const,
  paymentAccounts: (activeOnly = false) =>
    ['billing', 'config', 'payment-accounts', activeOnly] as const,
  readyToBill: (date?: string) =>
    ['billing', 'ready-to-bill', date ?? 'today'] as const,
  outstanding: (patientIds: string[]) =>
    ['billing', 'outstanding', [...patientIds].sort()] as const,
  cashClose: {
    preview: () => ['billing', 'cash-close', 'preview'] as const,
    history: (filters: object = {}) =>
      ['billing', 'cash-close', 'history', filters] as const,
  },
  reports: {
    doctorRevenue: (range: object) =>
      ['billing', 'reports', 'doctor-revenue', range] as const,
  },
  planSummary: (planId: string) => ['billing', 'plan-summary', planId] as const,
  activity: (filters: object) => ['billing', 'activity', filters] as const,
}
