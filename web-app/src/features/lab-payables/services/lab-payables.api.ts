import api from '@/lib/api'
import type {
  AgingReport,
  BillLineKind,
  BillParams,
  CaseProfitRow,
  LabStatement,
  LabStatementDetail,
  MonthlyCostReport,
  Paginated,
  PaymentMethod,
  VendorBill,
  VendorBillDetail,
  VendorPayment,
} from '../types'

async function get<T>(url: string, params?: object): Promise<T> {
  const { data } = await api.get(url, { params })
  return data.data as T
}
async function post<T>(
  url: string,
  body?: object,
  headers?: Record<string, string>,
): Promise<T> {
  const { data } = await api.post(url, body ?? {}, { headers })
  return data.data as T
}

export interface PaymentInput {
  labId: string
  amountPaisa: number
  method: PaymentMethod
  reference?: string
  paidOn?: string
  notes?: string
  allocations: Array<{ billId: string; amountPaisa: number }>
}

export interface StatementInput {
  labId: string
  periodStart: string
  periodEnd: string
  statementRef?: string
  notes?: string
  lines: Array<{
    labReference?: string
    lineDate?: string
    description?: string
    amountPaisa: number
  }>
}

/** One key per "Record payment" click; a retried request reuses it. */
export const newPaymentKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const base = '/lab-payables'

/** Clinic finance for labs (clinic admins). */
export const labPayablesApi = {
  bills: (params: BillParams) =>
    get<Paginated<VendorBill>>(`${base}/bills`, params),
  bill: (id: string) => get<VendorBillDetail>(`${base}/bills/${id}`),
  updateBill: (
    id: string,
    body: {
      version: number
      vendorInvoiceNo?: string | null
      billDate?: string
      dueOn?: string | null
      taxBp?: number
      notes?: string | null
    },
  ) =>
    api
      .patch(`${base}/bills/${id}`, body)
      .then((r) => r.data.data as VendorBillDetail),
  addLine: (
    id: string,
    body: {
      version: number
      kind: BillLineKind
      description: string
      quantity: number
      unitCostPaisa: number
    },
  ) => post<VendorBillDetail>(`${base}/bills/${id}/lines`, body),
  syncOrder: (orderId: string) =>
    post<{ billId: string | null; changed: boolean }>(
      `${base}/orders/${orderId}/sync`,
    ),
  approve: (
    id: string,
    body: {
      version: number
      vendorInvoiceNo?: string
      dueOn?: string
      taxBp?: number
    },
  ) => post<VendorBillDetail>(`${base}/bills/${id}/approve`, body),
  voidBill: (id: string, body: { version: number; reason: string }) =>
    post<VendorBillDetail>(`${base}/bills/${id}/void`, body),

  payments: (params: { page?: number; limit?: number; labId?: string }) =>
    get<Paginated<VendorPayment>>(`${base}/payments`, params),
  pay: (body: PaymentInput, key: string) =>
    post<VendorPayment>(`${base}/payments`, body, { 'Idempotency-Key': key }),
  allocate: (
    id: string,
    body: {
      version: number
      allocations: Array<{ billId: string; amountPaisa: number }>
    },
  ) => post<VendorPayment>(`${base}/payments/${id}/allocations`, body),
  reversePayment: (id: string, body: { version: number; reason: string }) =>
    post<VendorPayment>(`${base}/payments/${id}/reverse`, body),

  statements: (params: {
    page?: number
    limit?: number
    labId?: string
    status?: string
  }) => get<Paginated<LabStatement>>(`${base}/statements`, params),
  statement: (id: string) =>
    get<LabStatementDetail>(`${base}/statements/${id}`),
  createStatement: (body: StatementInput) =>
    post<LabStatementDetail>(`${base}/statements`, body),
  statementStatus: (
    id: string,
    body: { version: number; status: 'reconciled' | 'disputed'; note?: string },
  ) => post<LabStatementDetail>(`${base}/statements/${id}/status`, body),

  aging: (labId?: string) =>
    get<AgingReport>(`${base}/reports/aging`, { labId }),
  monthlyCost: (year: number) =>
    get<MonthlyCostReport>(`${base}/reports/monthly-cost`, { year }),
  caseProfit: (params: {
    page?: number
    limit?: number
    labId?: string
    from?: string
    to?: string
  }) => get<Paginated<CaseProfitRow>>(`${base}/reports/case-profit`, params),
}
