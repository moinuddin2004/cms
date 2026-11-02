import type {
  LabLinkAction,
  LabLinkStatus,
  LabMemberRole,
  LabSummary,
} from '@/features/labs'
import type { LabMembership } from '@/store/useAuthStore'

export type { LabMembership }
export type { LabMember, LabMemberRole, LabLinkStatus } from '@/features/labs'

/** The caller's own lab, as the portal shows it. */
export interface PortalLab extends LabSummary {
  memberCount: number
  activeLinkCount: number
  version: number
  updatedAt: string
}

/**
 * A clinic the lab works with — only its name and city, plus the link's
 * status and payment terms. `id` / `version` belong to the link.
 */
export interface PortalClinic {
  id: string
  status: LabLinkStatus
  paymentTermsDays: number
  version: number
  clinic: { name: string; city: string | null }
}

export interface PortalClinicParams {
  search?: string
  status?: LabLinkStatus
}

export interface LabContactInput {
  phone: string | null
  whatsappPhone: string | null
  email: string | null
  city: string | null
  address: string | null
}

export type PortalLinkAction = LabLinkAction

/** How the lab side reads a link's status. */
export const PORTAL_LINK_STATUS_LABEL: Record<LabLinkStatus, string> = {
  invited: 'Invitation pending',
  active: 'Active',
  suspended: 'Suspended',
}

export const LAB_ROLE_LABEL: Record<LabMemberRole, string> = {
  lab_admin: 'Lab admin',
  lab_technician: 'Technician',
}

// ── Orders (Sprint 7) — the lab-safe order shape ─────────────────────────

/** What the lab side may do on an order (from the pinned workflows). */
export type LabOrderAction =
  'accept' | 'reject' | 'request_clarification' | 'change_expected_date'

export interface PortalPatientRef {
  /** Name or file number, as the clinic's link allows. */
  ref: string
  patientNumber: string
}

export interface PortalOrderRow {
  id: string
  orderNo: string | null
  status: string
  priority: 'normal' | 'urgent'
  clinic: { name: string }
  patient: PortalPatientRef
  doctor: { fullName: string } | null
  labExpectedOn: string | null
  submittedAt: string | null
  currentRevisionNo: number
  version: number
}

export interface PortalOrderParams {
  page: number
  limit: number
  status?: string
  search?: string
}

export interface PortalFormField {
  key: string
  type: string
  label?: string
  options?: { value: string; label: string }[]
}

export interface PortalOrderItem {
  id: string
  lineNo: number
  serviceCode: string | null
  serviceName: string | null
  unitType: string | null
  quantity: number
  rush: boolean
  options: { id: string; code: string; name: string }[] | null
  currency: string
  labUnitCostMinor: number
  labLineCostMinor: number
  status: string | null
  form: {
    code: string
    name: string
    versionNo: number
    schemaJson: { fields?: PortalFormField[] } | null
  } | null
  answers: Record<string, unknown>
  teeth: { tooth: string; role: string | null }[]
  details: Record<string, string | number | null> | null
}

export interface PortalOrderDetail {
  id: string
  orderNo: string | null
  status: string
  priority: 'normal' | 'urgent'
  requestedOn: string | null
  labExpectedOn: string | null
  notes: string | null
  currentRevisionNo: number
  submittedAt: string | null
  acceptedAt: string | null
  version: number
  clinic: { name: string }
  patient: PortalPatientRef
  doctor: { fullName: string } | null
  labCostMinor: number
  items: PortalOrderItem[]
  revisions: {
    id: string
    revisionNo: number
    reason: string | null
    createdAt: string
    labAcknowledgedAt: string | null
  }[]
  messages: {
    id: string
    kind: 'note' | 'clarification_request' | 'reply'
    authorSide: 'clinic' | 'lab'
    author: { id: string; name: string | null } | null
    body: string
    resolvedAt: string | null
    createdAt: string
  }[]
  attachments: {
    id: string
    fileName: string
    sizeBytes: number
    uploadedSide: 'clinic' | 'lab'
    createdAt: string
  }[]
}

/** The no-login page's payload (`GET /lab-link/:token`). */
export interface MagicLinkView {
  link: {
    purpose: 'lab_view_order' | 'lab_update_order'
    expiresAt: string
    lab: { name: string }
  }
  actions: LabOrderAction[]
  order: PortalOrderDetail
}

/** Where the work-order QR sends the signed-in user. */
export type OrderLinkTarget =
  | { target: 'lab'; labId: string; path: string }
  | {
      target: 'clinic'
      organizationId: string
      locationId: string
      path: string
    }

export interface AcceptInput {
  labExpectedOn: string
  note?: string
  version?: number
}
export interface RejectInput {
  reason: string
  version?: number
}
export interface ClarifyInput {
  body: string
}
export interface ExpectedDateInput {
  labExpectedOn: string
  reason: string
  version?: number
}

/** One way to act for the lab: portal, magic link or clinic proxy. */
export interface LabActionsApi {
  accept: (body: AcceptInput) => Promise<unknown>
  reject: (body: RejectInput) => Promise<unknown>
  clarify: (body: ClarifyInput) => Promise<unknown>
  changeExpectedDate?: (body: ExpectedDateInput) => Promise<unknown>
}

export const PORTAL_ORDER_STATUSES = [
  'submitted',
  'clarification_needed',
  'accepted',
  'in_progress',
  'on_hold',
  'partially_ready',
  'ready',
  'partially_received',
  'under_review',
  'completed',
  'rejected_by_lab',
  'cancelled',
] as const
