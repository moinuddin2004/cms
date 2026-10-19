export type LabType = 'external' | 'internal'
export type LabStatus = 'active' | 'suspended'
export type LabMemberRole = 'lab_admin' | 'lab_technician'
export type LabLinkStatus = 'invited' | 'active' | 'suspended'
export type PatientDataLevel = 'full_name' | 'code_only'
export type LabLinkAction = 'activate' | 'suspend' | 'reactivate'

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** What a clinic may see about a lab. */
export interface LabSummary {
  id: string
  name: string
  labType: LabType
  phone: string | null
  whatsappPhone: string | null
  email: string | null
  city: string | null
  address: string | null
  status: LabStatus
}

/** Platform (super admin) view of a lab. */
export interface Lab extends LabSummary {
  ownerOrganization: { id: string; name: string } | null
  memberCount: number
  activeLinkCount: number
  version: number
  createdAt: string
  updatedAt: string
}

export interface LabMember {
  id: string
  labId: string
  role: LabMemberRole
  isActive: boolean
  user: { id: string; name: string | null; email: string; phone: string | null }
  version: number
  createdAt: string
}

export interface LabLink {
  id: string
  status: LabLinkStatus
  paymentTermsDays: number
  patientDataLevel: PatientDataLevel
  activatedAt: string | null
  notes: string | null
  version: number
  createdAt: string
  updatedAt: string
  lab: LabSummary
}

/** A clinic's link as the platform sees it on the lab detail page. */
export interface LabLinkAdmin extends Omit<LabLink, 'lab'> {
  organization: { id: string; name: string }
}

export interface DirectoryLab extends LabSummary {
  link: { id: string; status: LabLinkStatus } | null
}

export interface TimelineEntry {
  id: string
  kind: 'audit' | 'status'
  action: string
  fromState: string | null
  toState: string | null
  changes: {
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
  } | null
  reason: string | null
  actorSide: 'clinic' | 'lab' | 'platform' | 'system'
  via: string | null
  actor: { id: string; name: string | null } | null
  createdAt: string
}

export interface LabListParams {
  page: number
  limit: number
  search?: string
  status?: LabStatus
  labType?: LabType
}

export interface LabLinkListParams {
  page: number
  limit: number
  search?: string
  status?: LabLinkStatus
}

export interface LabInput {
  name: string
  labType?: LabType
  ownerOrganizationId?: string | null
  phone: string | null
  whatsappPhone: string | null
  email: string | null
  city: string | null
  address: string | null
}

export interface LabLinkTermsInput {
  paymentTermsDays: number
  patientDataLevel: PatientDataLevel
  notes: string | null
}

export const LAB_TYPE_LABEL: Record<LabType, string> = {
  external: 'External',
  internal: 'In-house',
}

export const MEMBER_ROLE_LABEL: Record<LabMemberRole, string> = {
  lab_admin: 'Lab admin',
  lab_technician: 'Technician',
}

export const PATIENT_DATA_LABEL: Record<PatientDataLevel, string> = {
  full_name: 'Full patient name',
  code_only: 'Patient code only',
}

export const LINK_STATUS_LABEL: Record<LabLinkStatus, string> = {
  invited: 'Awaiting confirmation',
  active: 'Active',
  suspended: 'Suspended',
}
