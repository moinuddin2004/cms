import api from '@/lib/api'
import type {
  ActivityRow,
  BillingActivity,
  BillingSettings,
  CashClose,
  CashClosePreview,
  CatalogService,
  Charge,
  CollectPaymentInput,
  CollectResult,
  DailyCollection,
  DiscountKind,
  DiscountType,
  DoctorRevenueReport,
  EditInvoicePreview,
  Invoice,
  InvoiceEditOp,
  InvoiceListStatus,
  InvoiceStatsV2,
  OutstandingRow,
  Paginated,
  PatientBillingSummary,
  Payment,
  PaymentAccount,
  PaymentDetail,
  PaymentPreview,
  PaymentPreviewInput,
  PlanBillingSummary,
  ReadyToBillRow,
  Refund,
  RefundInput,
  ResolvedPrice,
  ServiceKind,
  ServicePriceOverride,
  Statement,
} from '../types/billing.types'

/** Unwraps `ResponseWrapper.success(data)` → data. */
async function get<T>(url: string, params?: object): Promise<T> {
  const { data } = await api.get(url, { params })
  return data.data as T
}
async function post<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.post(url, body ?? {})
  return data.data as T
}
async function patch<T>(url: string, body: unknown): Promise<T> {
  const { data } = await api.patch(url, body)
  return data.data as T
}
async function del<T>(url: string): Promise<T> {
  const { data } = await api.delete(url)
  return data.data as T
}

// ─── Configuration (admin writes) ───────────────────────────────────

export type ServiceInput = Pick<
  CatalogService,
  'name' | 'kind' | 'defaultPrice'
> &
  Partial<Pick<CatalogService, 'code' | 'isActive' | 'sortOrder'>>
export type PaymentAccountInput = Partial<Omit<PaymentAccount, 'id'>>
export type DiscountTypeInput = Partial<Omit<DiscountType, 'id'>>

export const configApi = {
  services: (params: { activeOnly?: boolean; kind?: ServiceKind } = {}) =>
    get<CatalogService[]>('/billing/services', params),
  createService: (body: ServiceInput) =>
    post<CatalogService>('/billing/services', body),
  updateService: (id: string, body: Partial<ServiceInput>) =>
    patch<CatalogService>(`/billing/services/${id}`, body),
  resolvedPrice: (serviceId: string, doctorId?: string) =>
    get<ResolvedPrice>(`/billing/services/${serviceId}/resolved-price`, {
      doctorId,
    }),
  prices: (serviceId?: string) =>
    get<ServicePriceOverride[]>('/billing/service-prices', { serviceId }),
  createPrice: (body: {
    serviceId: string
    doctorId?: string
    price: number
  }) => post<ServicePriceOverride>('/billing/service-prices', body),
  updatePrice: (id: string, price: number) =>
    patch<ServicePriceOverride>(`/billing/service-prices/${id}`, { price }),
  deletePrice: (id: string) => del<null>(`/billing/service-prices/${id}`),
  settings: () => get<BillingSettings>('/billing/settings'),
  updateSettings: (
    body: Partial<
      Omit<
        BillingSettings,
        'locationId' | 'locationName' | 'documentCodeLocked'
      >
    >,
  ) => patch<BillingSettings>('/billing/settings', body),
  accounts: (activeOnly = false) =>
    get<PaymentAccount[]>('/billing/payment-accounts', { activeOnly }),
  createAccount: (body: PaymentAccountInput) =>
    post<PaymentAccount>('/billing/payment-accounts', body),
  updateAccount: (id: string, body: PaymentAccountInput) =>
    patch<PaymentAccount>(`/billing/payment-accounts/${id}`, body),
  discountTypes: (usableToday = false) =>
    get<DiscountType[]>('/billing/discount-types', { usableToday }),
  createDiscountType: (body: DiscountTypeInput) =>
    post<DiscountType>('/billing/discount-types', body),
  updateDiscountType: (id: string, body: DiscountTypeInput) =>
    patch<DiscountType>(`/billing/discount-types/${id}`, body),
}

// ─── Charges ────────────────────────────────────────────────────────

export interface ManualChargeInput {
  serviceId?: string
  description?: string
  quantity?: number
  unitPrice?: number
  doctorId?: string
}

export interface DiscountInput {
  discountTypeId?: string
  kind?: DiscountKind
  value?: number
  note?: string
}

export const chargesApi = {
  list: (patientId: string, state: 'unbilled' | 'open' | 'all') =>
    get<Charge[]>(`/patients/${patientId}/charges`, { state }),
  addManual: (patientId: string, body: ManualChargeInput) =>
    post<Charge>(`/patients/${patientId}/charges`, body),
  update: (
    chargeId: string,
    body: { quantity?: number; unitPrice?: number; description?: string },
  ) => patch<Charge>(`/charges/${chargeId}`, body),
  setDiscount: (chargeId: string, body: DiscountInput) =>
    post<Charge>(`/charges/${chargeId}/discount`, body),
  removeDiscount: (chargeId: string) =>
    del<Charge>(`/charges/${chargeId}/discount`),
  bulkDiscount: (body: DiscountInput & { chargeIds: string[] }) =>
    post<{
      charges: Charge[]
      skipped: Array<{ chargeId: string; description: string }>
    }>('/charges/discount/bulk', body),
  void: (chargeId: string, reason: string) =>
    post<Charge>(`/charges/${chargeId}/void`, { reason }),
  readyToBill: (date?: string) =>
    get<ReadyToBillRow[]>('/billing/ready-to-bill', { date }),
}

// ─── Invoices ───────────────────────────────────────────────────────

export interface InvoiceFiltersV2 {
  paymentStatus?: InvoiceListStatus
  patientId?: string
  from?: string
  to?: string
  search?: string
  page?: number
  limit?: number
}

export const invoicesApi = {
  list: (filters: InvoiceFiltersV2) =>
    get<Paginated<Invoice>>('/invoices', filters),
  stats: (range: { from?: string; to?: string } = {}) =>
    get<InvoiceStatsV2>('/invoices/stats', range),
  detail: (id: string) => get<Invoice>(`/invoices/${id}`),
  issue: (body: { patientId: string; chargeIds: string[]; notes?: string }) =>
    post<Invoice>('/invoices', body),
  editPreview: (
    id: string,
    body: { expectedRevision: number; operations: InvoiceEditOp[] },
  ) => post<EditInvoicePreview>(`/invoices/${id}/edit/preview`, body),
  edit: (
    id: string,
    body: {
      expectedRevision: number
      operations: InvoiceEditOp[]
      reason: string
    },
  ) => post<Invoice>(`/invoices/${id}/edit`, body),
  cancel: (id: string, reason: string) =>
    post<Invoice>(`/invoices/${id}/cancel`, { reason }),
  refund: (
    id: string,
    body: {
      edit?: {
        expectedRevision: number
        operations: InvoiceEditOp[]
        reason: string
      }
      refund: RefundInput
    },
  ) => post<Refund>(`/invoices/${id}/refund`, body),
}

// ─── Payments, advance, refunds ─────────────────────────────────────

export const paymentsApi = {
  preview: (body: PaymentPreviewInput) =>
    post<PaymentPreview>('/payments/preview', body),
  collect: (body: CollectPaymentInput) =>
    post<CollectResult>('/payments', body),
  list: (params: {
    from?: string
    to?: string
    patientId?: string
    paymentAccountId?: string
    page?: number
    limit?: number
  }) => get<Paginated<Payment>>('/payments', params),
  detail: (id: string) => get<PaymentDetail>(`/payments/${id}`),
  dailyCollection: (date?: string) =>
    get<DailyCollection>('/payments/daily-collection', { date }),
  unapply: (
    id: string,
    body: {
      reason: string
      lines?: Array<{ chargeId: string; amount: number }>
    },
  ) => post<Payment>(`/payments/${id}/unapply`, body),
  applyAdvance: (
    patientId: string,
    body: Pick<PaymentPreviewInput, 'mode' | 'selections'>,
  ) => post<CollectResult>(`/patients/${patientId}/advance/apply`, body),
  refundAdvance: (body: RefundInput & { patientId: string }) =>
    post<Refund>('/refunds', body),
  refunds: (params: {
    from?: string
    to?: string
    patientId?: string
    page?: number
    limit?: number
  }) => get<Paginated<Refund>>('/refunds', params),
}

// ─── Patient billing, cash close, reports ───────────────────────────

export const reportsApi = {
  summary: (patientId: string) =>
    get<PatientBillingSummary>(`/patients/${patientId}/billing/summary`),
  openCharges: (patientId: string) =>
    get<Charge[]>(`/patients/${patientId}/billing/open-charges`),
  statement: (patientId: string, range: { from?: string; to?: string }) =>
    get<Statement>(`/patients/${patientId}/billing/statement`, range),
  outstanding: (patientIds: string[]) =>
    get<OutstandingRow[]>('/billing/outstanding', {
      patientIds: patientIds.join(','),
    }),
  cashClosePreview: () => get<CashClosePreview>('/billing/cash-close/preview'),
  createCashClose: (body: {
    periodEnd: string
    lines: Array<{ paymentAccountId: string; counted?: number }>
    note?: string
  }) => post<CashClose>('/billing/cash-close', body),
  cashCloses: (range: { from?: string; to?: string } = {}) =>
    get<CashClose[]>('/billing/cash-close', range),
  cashClose: (id: string) => get<CashClose>(`/billing/cash-close/${id}`),
  doctorRevenue: (range: { from: string; to: string }) =>
    get<DoctorRevenueReport>('/billing/reports/doctor-revenue', range),
  planSummary: (planId: string) =>
    get<PlanBillingSummary>(`/treatment-plans/${planId}/billing-summary`),
  activity: (params: {
    from?: string
    to?: string
    action?: string
    page?: number
    limit?: number
  }) => get<BillingActivity>('/billing/activity', params),
}

export type PrintDocumentType =
  'invoice' | 'receipt' | 'refund' | 'statement' | 'cash-close'

export const printApi = {
  /** Print payloads (9.1); shapes are consumed by the print templates. */
  load: (
    type: PrintDocumentType,
    id: string,
    params?: Record<string, string | number | undefined>,
  ) => {
    const path: Record<PrintDocumentType, string> = {
      invoice: `/print/invoices/${id}`,
      receipt: `/print/payments/${id}`,
      refund: `/print/refunds/${id}`,
      statement: `/print/patients/${id}/statement`,
      'cash-close': `/print/cash-close/${id}`,
    }
    return get<Record<string, unknown>>(path[type], params)
  },
}

export type { ActivityRow }
