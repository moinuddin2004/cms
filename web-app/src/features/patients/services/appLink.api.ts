import api from '@/lib/api'

export interface AppLinkStatus {
  status: 'none' | 'active'
  link: {
    id: string
    linkedAt: string
    maskedEmail: string | null
    relation: string
    linkMethod: string
  } | null
  pendingClaim: { expiresAt: string } | null
}

export interface ClaimToken {
  token: string
  url: string
  expiresAt: string
}

export async function fetchAppLink(patientId: string): Promise<AppLinkStatus> {
  const { data } = await api.get(`/patients/${patientId}/app-link`)
  return data.data
}

export async function createClaimToken(patientId: string): Promise<ClaimToken> {
  const { data } = await api.post(`/patients/${patientId}/app-link/claim-token`)
  return data.data
}

export async function revokeAppLink(
  patientId: string,
  reason?: string,
): Promise<void> {
  await api.delete(`/patients/${patientId}/app-link`, {
    data: reason ? { reason } : {},
  })
}
