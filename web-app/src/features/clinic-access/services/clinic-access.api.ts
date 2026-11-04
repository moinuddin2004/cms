import api from '@/lib/api'
import type {
  ApprovalStatus,
  JoinRequest,
  JoinRequestStatus,
  SignInPolicy,
  SignInPolicyResponse,
  ClinicInvite,
} from '../types'

// ── Sign-in policy (owner) ────────────────────────────────────────────
export const fetchSignInPolicy = async () =>
  (await api.get('/clinic/sign-in-policy')).data.data as SignInPolicyResponse

export const saveSignInPolicy = async (body: SignInPolicy) =>
  (await api.put('/clinic/sign-in-policy', body)).data.data as {
    policy: SignInPolicy
  }

// ── Join requests (owner / staff manager) ─────────────────────────────
export const fetchJoinRequests = async (status?: JoinRequestStatus) =>
  (await api.get('/join-requests', { params: status ? { status } : {} })).data
    .data as JoinRequest[]

export const approveJoinRequest = async (
  id: string,
  body: { designation: string; employmentRoleId?: string },
) => (await api.post(`/join-requests/${id}/approve`, body)).data.data

export const rejectJoinRequest = async (id: string, reason?: string) =>
  (await api.post(`/join-requests/${id}/reject`, { reason })).data.data

// ── Clinic approval (super admin) ─────────────────────────────────────
export const decideClinicApproval = async (
  orgId: string,
  body: { decision: 'approve' | 'reject'; note?: string },
) =>
  (await api.post(`/admin/clinics/${orgId}/approval`, body)).data.data as {
    organizationId: string
    approvalStatus: ApprovalStatus
    approvalNote: string | null
  }

// ── Invite links (owner / staff manager) ──────────────────────────────
export const fetchInvites = async () =>
  (await api.get('/join-invites')).data.data as ClinicInvite[]

export const createInvite = async () =>
  (await api.post('/join-invites')).data.data as ClinicInvite

export const revokeInvite = async (id: string) => {
  await api.delete(`/join-invites/${id}`)
}
