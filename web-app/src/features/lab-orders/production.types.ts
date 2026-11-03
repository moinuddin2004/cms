/** Lab production (Sprint 8, lab ERD §5b) — what `/lab-orders/:id/production` returns. */

export type ShipmentDirection = 'to_lab' | 'to_clinic'
export type ShipmentStatus =
  'dispatched' | 'partially_received' | 'received' | 'lost'
export type ShipmentContents =
  'impression' | 'model' | 'framework' | 'tryin' | 'final' | 'other'
export type ShipmentCondition = 'ok' | 'damaged' | 'missing'
export type RemakeReason =
  'shade' | 'fit' | 'fracture' | 'design' | 'damaged' | 'other'
export type ResponsibleParty = 'lab' | 'clinic' | 'patient' | 'undetermined'
export type RemakeStatus = 'requested' | 'agreed' | 'disputed' | 'closed'

export interface ItemStage {
  id: string
  seq: number
  roundNo: number
  code: string
  name: string
  isFinal: boolean
  requiresPatientVisit: boolean
  status: string
  isActive: boolean
  labExpectedOn: string | null
  appointmentId: string | null
  outcome: 'approved' | 'correction' | 'rejected' | null
  tryinNotes: string | null
  correctionNotes: string | null
  decidedAt: string | null
  decidedBy: string | null
  startedAt: string | null
  version: number
}

export interface ShipmentLine {
  id: string
  orderId: string
  orderNo: string | null
  itemId: string
  lineNo: number
  serviceName: string | null
  itemStatus: string | null
  stageId: string | null
  stageName: string | null
  stageRound: number | null
  contents: ShipmentContents
  quantity: number
  receivedQty: number | null
  condition: ShipmentCondition | null
  qcResult: 'pass' | 'fail' | null
  qcNotes: string | null
  receivedAt: string | null
}

export interface Shipment {
  id: string
  shipmentNo: string
  direction: ShipmentDirection
  status: ShipmentStatus
  courierName: string | null
  trackingNo: string | null
  notes: string | null
  dispatchedAt: string
  receivedAt: string | null
  lostAt: string | null
  lostReason: string | null
  qrToken: string
  qrValue: string
  version: number
  clinic: { name: string }
  lab: { id: string; name: string }
  lines: ShipmentLine[]
}

export interface RemakeRequest {
  id: string
  orderId: string
  orderNo: string | null
  originalItemId: string
  originalLineNo: number
  serviceName: string | null
  newItemId: string | null
  newLineNo: number | null
  reasonCode: RemakeReason
  notes: string | null
  responsibleParty: ResponsibleParty
  isWarrantyClaim: boolean
  labChargeMinor: number | null
  /** Clinic side only. */
  patientChargeMinor?: number | null
  status: RemakeStatus
  decidedAt: string | null
  decisionNote: string | null
  disputeNote: string | null
  createdAt: string
  version: number
  clinic: { name: string }
}

export interface ProductionItem {
  id: string
  lineNo: number
  serviceName: string | null
  quantity: number
  status: string | null
  currentStageSeq: number | null
  remakeOfItemId: string | null
  version: number
  assignee: { labMemberId: string; name: string | null } | null
  warranty: {
    id: string
    startsOn: string
    endsOn: string
    terms: string | null
    voidedAt: string | null
  } | null
  stages: ItemStage[]
  shipmentLines: (ShipmentLine & {
    shipmentId: string
    shipmentNo: string
    direction: ShipmentDirection
    shipmentStatus: ShipmentStatus
  })[]
}

export interface OrderProduction {
  items: ProductionItem[]
  shipments: Shipment[]
  remakeRequests: RemakeRequest[]
}

export interface ReceiveLineInput {
  shipmentItemId: string
  receivedQty: number
  condition: ShipmentCondition
  qcResult?: 'pass' | 'fail'
  qcNotes?: string
}

export const REMAKE_REASON_LABEL: Record<RemakeReason, string> = {
  shade: 'Shade',
  fit: 'Fit',
  fracture: 'Fracture',
  design: 'Design',
  damaged: 'Damaged',
  other: 'Other',
}

export const RESPONSIBLE_LABEL: Record<ResponsibleParty, string> = {
  lab: 'Lab (remade free)',
  clinic: 'Clinic (clinic pays the lab)',
  patient: 'Patient (charged again)',
  undetermined: 'Undetermined',
}

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  dispatched: 'In transit',
  partially_received: 'Partially received',
  received: 'Received',
  lost: 'Lost',
}

export const STAGE_STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  at_lab: 'At lab',
  sent_to_clinic: 'Sent to clinic',
  received: 'Received',
  tryin_done: 'Try-in done',
  approved: 'Approved',
  correction: 'Correction',
}

export const SHIPMENT_CONTENTS_LABEL: Record<ShipmentContents, string> = {
  impression: 'Impression',
  model: 'Model',
  framework: 'Framework',
  tryin: 'Try-in',
  final: 'Final work',
  other: 'Other',
}
