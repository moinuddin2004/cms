export interface SignInPolicy {
  googleEnabled: boolean
  requireGoogle: boolean
  googleDomains: string[]
  joinRequestsEnabled: boolean
}

export interface SignInPolicyResponse {
  policy: SignInPolicy
  /** GOOGLE_CLIENT_ID is set on the server. */
  googleConfigured: boolean
  /** How the owner's current session signed in. */
  sessionMethod: 'password' | 'google' | string
  sessionDomain: string | null
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected'

export interface JoinRequest {
  id: string
  organizationId: string
  userId: string
  email: string
  name: string
  phone: string
  message: string | null
  status: JoinRequestStatus
  decisionNote: string | null
  decidedAt: string | null
  createdAt: string
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
