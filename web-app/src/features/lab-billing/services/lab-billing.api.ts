import api from '@/lib/api'
import type {
  InvoiceInput,
  InvoiceParams,
  LabInvoiceDetail,
  LabInvoiceRow,
  LabPaymentDetail,
  LabPaymentRow,
  OrderBilling,
  Paginated,
  PatientBillingSummary,
  PaymentInput,
  PaymentParams,
} from '../types'

async function get<T>(url: string, params?: object): Promise<T> {
  const { data } = await api.get(url, { params })
  return data.data as T
}
async function post<T>(url: string, body?: object, key?: string): Promise<T> {
  const { data } = await api.post(url, body ?? {}, {
    headers: key ? { 'Idempotency-Key': key } : undefined,
  })
  return data.data as T
}

/** A fresh key per user action; a retry of the same action reuses it. */
export const newIdempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

/** Patient billing for lab work. Money-moving calls carry an Idempotency-Key. */
export const labBillingApi = {
  invoices: (params: InvoiceParams) =>
    get<Paginated<LabInvoiceRow>>('/lab-billing/invoices', params),
  invoice: (id: string) => get<LabInvoiceDetail>(`/lab-billing/invoices/${id}`),
  createInvoice: (body: InvoiceInput) =>
    post<LabInvoiceDetail>('/lab-billing/invoices', body),
  updateInvoice: (id: string, body: InvoiceInput & { version: number }) =>
    api
      .patch(`/lab-billing/invoices/${id}`, body)
      .then((r) => r.data.data as LabInvoiceDetail),
  issue: (id: string, version: number) =>
    post<LabInvoiceDetail>(`/lab-billing/invoices/${id}/issue`, { version }),
  void: (id: string, version: number, reason: string) =>
    post<LabInvoiceDetail>(`/lab-billing/invoices/${id}/void`, {
      version,
      reason,
    }),
  applyAdvance: (id: string, key: string) =>
    post<LabInvoiceDetail>(
      `/lab-billing/invoices/${id}/apply-advance`,
      {},
      key,
    ),
  creditNote: (
    id: string,
    body: { amountPaisa: number; reason: string },
    key: string,
  ) =>
    post<LabInvoiceDetail>(
      `/lab-billing/invoices/${id}/credit-notes`,
      body,
      key,
    ),
  remind: (id: string) =>
    post<Array<{ channel: string; status: string }>>(
      `/lab-billing/invoices/${id}/remind`,
    ),
  payments: (params: PaymentParams) =>
    get<Paginated<LabPaymentRow>>('/lab-billing/payments', params),
  payment: (id: string) => get<LabPaymentDetail>(`/lab-billing/payments/${id}`),
  collect: (body: PaymentInput, key: string) =>
    post<LabPaymentDetail>('/lab-billing/payments', body, key),
  reverse: (id: string, reason: string, key: string) =>
    post<LabPaymentDetail>(
      `/lab-billing/payments/${id}/reverse`,
      { reason },
      key,
    ),
  refund: (
    body: {
      patientId: string
      amountPaisa: number
      method: string
      reason: string
      reference?: string
      creditNoteId?: string
    },
    key: string,
  ) =>
    post<{ id: string; summary: PatientBillingSummary }>(
      '/lab-billing/refunds',
      body,
      key,
    ),
  order: (orderId: string) =>
    get<OrderBilling>(`/lab-billing/orders/${orderId}`),
  settings: () =>
    get<{ taxRateBp: number; dueDays: number }>('/lab-billing/settings'),
  updateSettings: (body: { taxRateBp?: number; dueDays?: number }) =>
    api
      .patch('/lab-billing/settings', body)
      .then((r) => r.data.data as { taxRateBp: number; dueDays: number }),
  patientSummary: (patientId: string) =>
    get<PatientBillingSummary>(`/lab-billing/patients/${patientId}/summary`),
}
