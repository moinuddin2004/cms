import api from '@/lib/api'
import type {
  OrderProduction,
  ReceiveLineInput,
  RemakeReason,
  ResponsibleParty,
  Shipment,
  ShipmentContents,
} from '../production.types'

async function get<T>(url: string): Promise<T> {
  const { data } = await api.get(url)
  return data.data as T
}
async function post<T>(url: string, body?: object): Promise<T> {
  const { data } = await api.post(url, body ?? {})
  return data.data as T
}

/** Clinic side of production: stages, try-ins, remakes, shipments. */
export const productionApi = {
  get: (orderId: string) =>
    get<OrderProduction>(`/lab-orders/${orderId}/production`),
  tryin: (
    orderId: string,
    stageId: string,
    body: { notes?: string; version?: number },
  ) =>
    post<OrderProduction>(
      `/lab-orders/${orderId}/stages/${stageId}/tryin`,
      body,
    ),
  decide: (
    orderId: string,
    stageId: string,
    body: { decision: 'approve' | 'correction'; notes?: string },
  ) =>
    post<OrderProduction>(
      `/lab-orders/${orderId}/stages/${stageId}/decision`,
      body,
    ),
  reject: (
    orderId: string,
    itemId: string,
    body: { reasonCode: RemakeReason; reason: string },
  ) =>
    post<OrderProduction>(
      `/lab-orders/${orderId}/items/${itemId}/reject`,
      body,
    ),
  approve: (orderId: string, itemId: string) =>
    post<OrderProduction>(`/lab-orders/${orderId}/items/${itemId}/approve`),
  deliver: (orderId: string, itemId: string) =>
    post<OrderProduction>(`/lab-orders/${orderId}/items/${itemId}/deliver`),
  cancelItem: (orderId: string, itemId: string, reason: string) =>
    post<OrderProduction>(`/lab-orders/${orderId}/items/${itemId}/cancel`, {
      reason,
    }),
  requestRemake: (
    orderId: string,
    itemId: string,
    body: { reasonCode: RemakeReason; notes?: string },
  ) =>
    post<OrderProduction>(
      `/lab-orders/${orderId}/items/${itemId}/remake-requests`,
      body,
    ),
  decideRemake: (
    orderId: string,
    remakeId: string,
    body: {
      decision: 'agree' | 'close'
      version: number
      responsibleParty?: ResponsibleParty
      note?: string
    },
  ) =>
    post<OrderProduction>(
      `/lab-orders/${orderId}/remake-requests/${remakeId}/decision`,
      body,
    ),

  shipmentByToken: (token: string) =>
    get<Shipment>(`/lab-shipments/by-token/${encodeURIComponent(token)}`),
  receive: (
    shipmentId: string,
    body: { lines: ReceiveLineInput[]; viaQr?: boolean },
  ) => post<Shipment>(`/lab-shipments/${shipmentId}/receive`, body),
  markLost: (shipmentId: string, reason: string) =>
    post<Shipment>(`/lab-shipments/${shipmentId}/lost`, { reason }),
  sendToLab: (body: {
    lines: { itemId: string; contents: ShipmentContents; quantity?: number }[]
    courierName?: string
    trackingNo?: string
    notes?: string
  }) => post<Shipment>('/lab-shipments', body),
}
