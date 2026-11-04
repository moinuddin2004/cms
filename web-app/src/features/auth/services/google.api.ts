import api from '@/lib/api'
import type { LoginPayload } from '../lib/applyLogin'

export interface GoogleConfig {
  enabled: boolean
  clientId: string | null
}

export interface GoogleProfile {
  email: string
  name: string
  picture: string | null
}

export interface JoinableClinic {
  id: string
  name: string
}

export type GoogleSignInResult =
  | { outcome: 'signed_in'; session: LoginPayload }
  | {
      outcome: 'no_account'
      profile: GoogleProfile
      joinableClinics: JoinableClinic[]
    }
  | { outcome: 'link_required'; email: string; message: string }

export interface LoginMethods {
  hasPassword: boolean
  google: { email: string | null; linkedAt: string } | null
  googleConfigured: boolean
}

export interface MyJoinRequest {
  id: string
  organizationId: string
  organizationName: string
  status: 'pending' | 'approved' | 'rejected'
  decisionNote: string | null
  createdAt: string
  decidedAt: string | null
}

async function post<T>(url: string, body?: object): Promise<T> {
  const { data } = await api.post(url, body)
  return data.data as T
}

export const fetchGoogleConfig = async () =>
  (await api.get('/auth/google/config')).data.data as GoogleConfig

export const googleSignIn = (credential: string, rememberMe = true) =>
  post<GoogleSignInResult>('/auth/google', { credential, rememberMe })

export const googleRegister = (body: {
  credential: string
  clinicName: string
  phone?: string
}) => post<LoginPayload>('/auth/google/register', body)

export const googleJoinRequest = (body: {
  credential: string
  /** A clinic that takes requests from the account's Workspace domain… */
  organizationId?: string
  /** …or the token of the clinic's invite link. */
  inviteToken?: string
  phone: string
  message?: string
}) => post<LoginPayload>('/auth/google/join-request', body)

export type InviteInfo =
  | { valid: false }
  | {
      valid: true
      organizationId: string
      clinicName: string
      googleEnabled: boolean
      expiresAt: string
    }

export const fetchInviteInfo = async (token: string) =>
  (await api.get(`/public/join-invites/${encodeURIComponent(token)}`)).data
    .data as InviteInfo

export const fetchLoginMethods = async () =>
  (await api.get('/auth/login-methods')).data.data as LoginMethods

export const linkGoogle = (credential: string) =>
  post<LoginMethods>('/auth/google/link', { credential })

export const unlinkGoogle = async () =>
  (await api.delete('/auth/google/link')).data.data as LoginMethods

export const addPassword = (newPassword: string) =>
  post<{ message: string }>('/auth/add-password', { newPassword })

export const fetchMyJoinRequests = async () =>
  (await api.get('/join-requests/mine')).data.data as MyJoinRequest[]

export const createOwnClinic = (body: { clinicName: string; phone?: string }) =>
  post<LoginPayload>('/auth/create-clinic', body)
