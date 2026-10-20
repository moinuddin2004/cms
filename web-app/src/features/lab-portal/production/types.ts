import type { ItemStage } from '@/features/lab-orders'

export type {
  ItemStage,
  RemakeRequest,
  Shipment,
  ShipmentLine,
  ShipmentStatus,
  ShipmentDirection,
} from '@/features/lab-orders'

/** One item in the lab's work queue (no clinic prices, lab ERD §13). */
export interface LabProductionItem {
  id: string
  orderId: string
  orderNo: string | null
  priority: 'normal' | 'urgent'
  lineNo: number
  serviceName: string | null
  quantity: number
  status: string
  remakeOfItemId: string | null
  version: number
  labExpectedOn: string | null
  clinic: { name: string }
  patient: { ref: string }
  activeStage: {
    id: string
    name: string
    roundNo: number
    status: string
    isFinal: boolean
  } | null
  stageCount: number
  assignee: { labMemberId: string; name: string | null } | null
}

export interface LabProductionParams {
  status?: string
  search?: string
  assigneeId?: string
  page: number
  limit: number
}

export interface Technician {
  id: string
  name: string | null
  role: 'lab_admin' | 'lab_technician'
}

export interface Paged<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export type { ItemStage as LabItemStage }

/** What the lab can do next with an item (drives the action buttons). */
export function nextLabStep(
  i: LabProductionItem,
): 'start' | 'ship_tryin' | 'finish' | 'qc' | 'ship_final' | null {
  if (i.status === 'accepted') return 'start'
  if (i.status === 'qc') return 'qc'
  if (i.status === 'ready') return 'ship_final'
  if (i.status !== 'in_production') return null
  const s = i.activeStage
  if (!s) return 'finish'
  if (s.status !== 'at_lab') return null
  return s.isFinal ? 'finish' : 'ship_tryin'
}

export const PRODUCTION_STATUS_FILTERS = [
  { value: 'accepted', label: 'To start' },
  { value: 'in_production', label: 'In production' },
  { value: 'at_clinic_tryin', label: 'At clinic for try-in' },
  { value: 'qc', label: 'Quality check' },
  { value: 'ready', label: 'Ready to ship' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'received', label: 'Received by clinic' },
  { value: 'delivered', label: 'Delivered' },
]
