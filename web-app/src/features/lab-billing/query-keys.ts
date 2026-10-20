import type { InvoiceParams, PaymentParams } from './types'

/** Every lab-billing query under one root, so a mutation refreshes them all. */
export const labBillingKeys = {
  all: ['lab-billing'] as const,
  invoices: (params: InvoiceParams) =>
    ['lab-billing', 'invoices', params] as const,
  invoice: (id: string) => ['lab-billing', 'invoice', id] as const,
  payments: (params: PaymentParams) =>
    ['lab-billing', 'payments', params] as const,
  payment: (id: string) => ['lab-billing', 'payment', id] as const,
  order: (orderId: string) => ['lab-billing', 'order', orderId] as const,
}
