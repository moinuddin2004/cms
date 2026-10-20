// Lab orders (Sprint 6) — shapes of the clinic `/lab-orders` API.

export type OrderPriority = 'normal' | 'urgent'

/** Order workflow states (DENTAL_ORDER v1); other workflows may add more. */
export const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  clarification_needed: 'Clarification needed',
  rejected_by_lab: 'Rejected by lab',
  accepted: 'Accepted',
  in_progress: 'In progress',
  on_hold: 'On hold',
  partially_ready: 'Partially ready',
  ready: 'Ready',
  partially_received: 'Partially received',
  under_review: 'Under review',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const ITEM_STATUS_LABEL: Record<string, string> = {
  pending_acceptance: 'Waiting for lab',
  accepted: 'Accepted',
  in_production: 'In production',
  at_clinic_tryin: 'At clinic for try-in',
  qc: 'Quality check',
  ready: 'Ready',
  dispatched: 'Dispatched',
  received: 'Received',
  approved: 'Approved',
  delivered: 'Delivered',
  rejected: 'Rejected by lab',
  cancelled: 'Cancelled',
  remake_required: 'Remake required',
}

export const statusLabel = (s: string | null, map = ORDER_STATUS_LABEL) =>
  s ? (map[s] ?? s.replace(/_/g, ' ')) : '—'

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface LabOrderRow {
  id: string
  orderNo: string | null
  status: string
  priority: OrderPriority
  patient: { id: string; fullName: string; patientNumber: string }
  doctor: { id: string; fullName: string } | null
  lab: { id: string; name: string }
  itemCount: number
  labCostPaisa: number | null
  patientPricePaisa: number | null
  requestedOn: string | null
  labExpectedOn: string | null
  submittedAt: string | null
  createdAt: string
  version: number
}

export interface LabOrderParams {
  page: number
  limit: number
  search?: string
  status?: string
  labId?: string
  doctorId?: string
  patientId?: string
  from?: string
  to?: string
  submittedOnly?: boolean
}

export interface OrderWarning {
  code: 'LAB_DUE_AFTER_NEXT_APPOINTMENT'
  message: string
  appointmentId: string
  appointmentOn: string
  labExpectedOn: string
}

export interface ToothRow {
  tooth: string
  dentition: string
  role: string | null
  surfaces: string[]
}

export interface PinnedForm {
  versionId: string
  versionNo: number
  code: string
  name: string
  schemaJson: unknown
  uiJson: unknown
}

export interface UserRef {
  id: string
  name: string | null
}

export interface LabOrderItem {
  id: string
  lineNo: number
  labServiceId: string
  serviceCode: string | null
  serviceName: string | null
  unitType: string | null
  quantity: number
  rush: boolean
  optionIds: string[]
  options:
    | { id: string; code: string; name: string; extraCostPaisa: number }[]
    | null
  clinicTreatmentId: string | null
  prices: {
    currency: string
    labUnitCostPaisa: number
    labLineCostPaisa: number
    patientUnitPricePaisa: number
    patientLinePricePaisa: number
    pricedOn: string | null
  } | null
  status: string | null
  form: PinnedForm | null
  answers: Record<string, unknown>
  validatedAt: string | null
  teeth: ToothRow[]
  details: Record<string, string | number | null> | null
  version: number
}

export interface OrderRevision {
  id: string
  revisionNo: number
  reason: string | null
  createdBy: UserRef | null
  createdAt: string
  labAcknowledgedAt: string | null
}

export interface OrderMessage {
  id: string
  itemId: string | null
  kind: 'note' | 'clarification_request' | 'reply'
  authorSide: 'clinic' | 'lab'
  author: UserRef | null
  body: string
  resolvedAt: string | null
  createdAt: string
}

export interface ChargeRequest {
  id: string
  itemId: string | null
  kind: string
  amountPaisa: number
  currency: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requestedBy: UserRef | null
  decidedBy: UserRef | null
  decidedAt: string | null
  decisionNote: string | null
  createdAt: string
  version: number
}

export type AttachmentVisibility = 'internal' | 'lab_shared' | 'patient_shared'

export interface OrderAttachment {
  id: string
  entityType: 'lab_order' | 'lab_order_item'
  entityId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  sha256: string
  visibility: AttachmentVisibility
  uploadedSide: 'clinic' | 'lab'
  uploadedBy: UserRef | null
  createdAt: string
}

export interface HistoryEntry {
  id: string
  kind: 'audit' | 'status'
  action: string
  fromState: string | null
  toState: string | null
  reason: string | null
  actorSide: string
  via: string | null
  actor: UserRef | null
  createdAt: string
}

export interface LabOrderDetail {
  id: string
  orderNo: string | null
  status: string
  priority: OrderPriority
  requestedOn: string | null
  labExpectedOn: string | null
  notes: string | null
  currentRevisionNo: number
  appointmentId: string | null
  orderTemplateId: string | null
  submittedAt: string | null
  createdAt: string
  version: number
  patient: { id: string; fullName: string; patientNumber: string }
  doctor: { id: string; fullName: string } | null
  lab: { id: string; name: string; city: string | null }
  totals: { labCostPaisa: number; patientPricePaisa: number } | null
  items: LabOrderItem[]
  revisions: OrderRevision[]
  messages: OrderMessage[]
  charges: ChargeRequest[]
  attachments: OrderAttachment[]
  history: HistoryEntry[]
  availableActions: string[]
  warnings: OrderWarning[]
  replayed?: boolean
}

/** One line as the create / edit sheet sends it. */
export interface OrderItemInput {
  id?: string
  labServiceId: string
  optionIds: string[]
  quantity: number
  rush: boolean
  answers: Record<string, unknown>
}

export interface OrderInput {
  patientId: string
  labId: string
  doctorId?: string | null
  priority: OrderPriority
  requestedOn: string | null
  notes: string | null
  items: OrderItemInput[]
}

/** One issue of a refused submit (per line). */
export interface OrderIssue {
  line: number | null
  path: string
  code: string
  message: string
}

export interface WorkOrder {
  orderNo: string
  qrValue: string
  priority: OrderPriority
  revisionNo: number
  submittedAt: string | null
  requestedOn: string | null
  labExpectedOn: string | null
  notes: string | null
  clinic: { name: string; location: string | null }
  lab: { name: string; city: string | null; phone: string | null }
  patient: { ref: string; patientNumber: string }
  doctor: { fullName: string } | null
  items: {
    lineNo: number
    serviceCode: string | null
    serviceName: string | null
    quantity: number
    rush: boolean
    options: string[]
    teeth: { tooth: string; role: string | null }[]
    answers: { label: string; value: string }[]
  }[]
}
