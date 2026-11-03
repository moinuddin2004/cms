import api from '@/lib/api'
import type { Paginated } from '@/features/lab-orders'
import type {
  AcceptInput,
  ChargeRequestInput,
  ClarifyInput,
  ExpectedDateInput,
  LabOrderAction,
  MagicLinkView,
  OrderLinkTarget,
  PortalOrderDetail,
  PortalOrderParams,
  PortalOrderRow,
  RejectInput,
} from '../types'

async function get<T>(url: string, params?: object): Promise<T> {
  const { data } = await api.get(url, { params })
  return data.data as T
}
async function post<T>(url: string, body?: object): Promise<T> {
  const { data } = await api.post(url, body)
  return data.data as T
}

/** Lab portal orders — `x-lab-id` is added by the axios client. */
export const portalOrdersApi = {
  list: (params: PortalOrderParams) =>
    get<Paginated<PortalOrderRow>>('/lab-portal/orders', params),
  get: (id: string) => get<PortalOrderDetail>(`/lab-portal/orders/${id}`),
  actions: (id: string) =>
    get<{ actions: LabOrderAction[] }>(`/lab-portal/orders/${id}/actions`),
  accept: (id: string, body: AcceptInput) =>
    post<PortalOrderDetail>(`/lab-portal/orders/${id}/accept`, body),
  reject: (id: string, body: RejectInput) =>
    post<PortalOrderDetail>(`/lab-portal/orders/${id}/reject`, body),
  clarify: (id: string, body: ClarifyInput) =>
    post<PortalOrderDetail>(`/lab-portal/orders/${id}/clarification`, body),
  changeExpectedDate: (id: string, body: ExpectedDateInput) =>
    post<PortalOrderDetail>(`/lab-portal/orders/${id}/expected-date`, body),
  note: (id: string, body: string) =>
    post<PortalOrderDetail>(`/lab-portal/orders/${id}/messages`, {
      kind: 'note',
      body,
    }),
  acknowledge: (id: string, revisionNo: number) =>
    post<PortalOrderDetail>(
      `/lab-portal/orders/${id}/revisions/${revisionNo}/acknowledge`,
    ),
  attachmentUrl: (id: string, attachmentId: string) =>
    get<{ url: string }>(
      `/lab-portal/orders/${id}/attachments/${attachmentId}/url`,
    ),
  /** Lab admins only: an extra charge the clinic approves or rejects. */
  requestCharge: (id: string, body: ChargeRequestInput) =>
    post<PortalOrderDetail>(`/lab-portal/orders/${id}/charge-requests`, body),
  /** Lab uploads are always shared with the clinic. */
  upload: async (id: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post(
      `/lab-portal/orders/${id}/attachments`,
      form,
    )
    return data.data as { id: string; fileName: string; sha256: string }
  },
}

/** The no-login magic-link page: the token in the path is the credential. */
export const magicLinkApi = {
  view: (token: string) => get<MagicLinkView>(`/lab-link/${token}`),
  accept: (token: string, body: AcceptInput) =>
    post(`/lab-link/${token}/accept`, body),
  reject: (token: string, body: RejectInput) =>
    post(`/lab-link/${token}/reject`, body),
  clarify: (token: string, body: ClarifyInput) =>
    post(`/lab-link/${token}/clarification`, body),
  attachmentUrl: (token: string, attachmentId: string) =>
    get<{ url: string }>(`/lab-link/${token}/attachments/${attachmentId}/url`),
}

/** Work-order QR: where this user should open the order. */
export const orderLinkApi = {
  resolve: (orderId: string) => get<OrderLinkTarget>(`/order-links/${orderId}`),
}
