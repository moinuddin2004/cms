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
  clockOffsetMs: number
}

export async function fetchAppLink(patientId: string): Promise<AppLinkStatus> {
  const { data } = await api.get(`/patients/${patientId}/app-link`)
  return data.data
}

/**
 * `clockOffsetMs` = server clock − this PC's clock, from the response `Date`
 * header (0 when the browser can't read it), so the countdown is not skewed
 * by a wrong PC clock.
 */
export async function createClaimToken(patientId: string): Promise<ClaimToken> {
  const res = await api.post(`/patients/${patientId}/app-link/claim-token`)
  const serverNow = Date.parse(String(res.headers.date ?? ''))
  return {
    ...res.data.data,
    clockOffsetMs: Number.isNaN(serverNow) ? 0 : serverNow - Date.now(),
  }
}

export async function revokeAppLink(
  patientId: string,
  reason?: string,
): Promise<void> {
  await api.delete(`/patients/${patientId}/app-link`, {
    data: reason ? { reason } : {},
  })
}
