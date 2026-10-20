import api from '@/lib/api'
import type {
  LabItemStage,
  LabProductionItem,
  LabProductionParams,
  Paged,
  RemakeRequest,
  Shipment,
  Technician,
} from './types'

async function get<T>(url: string, params?: object): Promise<T> {
  const { data } = await api.get(url, { params })
  return data.data as T
}
async function post<T>(url: string, body?: object): Promise<T> {
  const { data } = await api.post(url, body ?? {})
  return data.data as T
}

const base = '/lab-portal/production'

/** Lab portal production desk (headers: `x-lab-id`, never clinic ones). */
export const labProductionApi = {
  items: (params: LabProductionParams) =>
    get<Paged<LabProductionItem>>(`${base}/items`, params),
  stages: (itemId: string) =>
    get<LabItemStage[]>(`${base}/items/${itemId}/stages`),
  technicians: () => get<Technician[]>(`${base}/technicians`),
  start: (itemId: string) => post<null>(`${base}/items/${itemId}/start`),
  finish: (itemId: string) => post<null>(`${base}/items/${itemId}/finish`),
  qc: (itemId: string, body: { result: 'pass' | 'fail'; notes?: string }) =>
    post<null>(`${base}/items/${itemId}/qc`, body),
  assign: (itemId: string, labMemberId: string) =>
    post<null>(`${base}/items/${itemId}/assign`, { labMemberId }),
  unassign: (itemId: string) => post<null>(`${base}/items/${itemId}/unassign`),
  shipments: (params: {
    status?: string
    direction?: string
    page: number
    limit: number
  }) => get<Paged<Shipment>>(`${base}/shipments`, params),
  dispatch: (body: {
    lines: { itemId: string }[]
    courierName?: string
    trackingNo?: string
    notes?: string
  }) => post<Shipment>(`${base}/shipments`, body),
  receive: (
    id: string,
    lines: {
      shipmentItemId: string
      receivedQty: number
      condition: 'ok' | 'damaged' | 'missing'
    }[],
  ) => post<Shipment>(`${base}/shipments/${id}/receive`, { lines }),
  lost: (id: string, reason: string) =>
    post<Shipment>(`${base}/shipments/${id}/lost`, { reason }),
  remakes: (status?: string) =>
    get<RemakeRequest[]>(`${base}/remake-requests`, { status }),
  dispute: (id: string, version: number, note: string) =>
    post<null>(`${base}/remake-requests/${id}/dispute`, { version, note }),
}
