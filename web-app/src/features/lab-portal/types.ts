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
