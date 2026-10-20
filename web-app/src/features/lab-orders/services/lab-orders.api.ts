import api from '@/lib/api'
import type {
  LabOrderDetail,
  LabOrderParams,
  LabOrderRow,
  OrderInput,
  Paginated,
  WorkOrder,
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
  const { data } = await api.post(url, body, { headers })
  return data.data as T
}

/** A fresh key per user action; retries of the same action reuse it. */
export const newIdempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export const labOrdersApi = {
  list: (params: LabOrderParams) =>
    get<Paginated<LabOrderRow>>('/lab-orders', params),
  get: (id: string) => get<LabOrderDetail>(`/lab-orders/${id}`),
  create: (body: OrderInput, key: string) =>
    post<LabOrderDetail>('/lab-orders', body, { 'Idempotency-Key': key }),
  update: (
    id: string,
    body: Partial<Omit<OrderInput, 'patientId' | 'labId'>> & {
      version: number
    },
  ) =>
    api
      .patch(`/lab-orders/${id}`, body)
      .then((r) => r.data.data as LabOrderDetail),
  submit: (id: string, version: number, key: string) =>
    post<LabOrderDetail>(
      `/lab-orders/${id}/submit`,
      { version },
      {
        'Idempotency-Key': key,
      },
    ),
  repeat: (id: string, patientId?: string) =>
    post<LabOrderDetail>(
      `/lab-orders/${id}/repeat`,
      patientId ? { patientId } : {},
    ),
  fromTemplate: (templateId: string, patientId: string) =>
    post<LabOrderDetail>('/lab-orders/from-template', {
      templateId,
      patientId,
    }),
  transition: (
    id: string,
    body: { action: string; version: number; reason?: string | null },
  ) => post<LabOrderDetail>(`/lab-orders/${id}/transitions`, body),
  revise: (
    id: string,
    body: {
      version: number
      reason: string
      items: {
        itemId: string
        answers?: Record<string, unknown>
        quantity?: number
      }[]
    },
  ) => post<LabOrderDetail>(`/lab-orders/${id}/revisions`, body),
  message: (id: string, body: { kind: 'note' | 'reply'; body: string }) =>
    post<LabOrderDetail>(`/lab-orders/${id}/messages`, body),
  decideCharge: (
    id: string,
    chargeId: string,
    body: {
      decision: 'approve' | 'reject'
      version: number
      note?: string | null
    },
  ) =>
    post<LabOrderDetail>(
      `/lab-orders/${id}/charge-requests/${chargeId}/decision`,
      body,
    ),
  upload: async (
    id: string,
    file: File,
    opts: { visibility?: string; itemId?: string } = {},
  ) => {
    const form = new FormData()
    form.append('file', file)
    if (opts.visibility) form.append('visibility', opts.visibility)
    if (opts.itemId) form.append('itemId', opts.itemId)
    const { data } = await api.post(`/lab-orders/${id}/attachments`, form)
    return data.data as { id: string; fileName: string; sha256: string }
  },
  attachmentUrl: (id: string, attachmentId: string) =>
    get<{ url: string; expiresAt: string }>(
      `/lab-orders/${id}/attachments/${attachmentId}/url`,
    ),
  workOrder: (id: string) => get<WorkOrder>(`/lab-orders/${id}/work-order`),
}
