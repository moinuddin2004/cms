import api from '@/lib/api'

export interface OrgFeature {
  key: string
  name: string
  module: string
  description: string | null
  specialtyTags: string[]
  enabledByDefault: boolean
  sortOrder: number
  /** Same as `enabled` (older field). */
  isEnabled: boolean
  /** Super admin's entitlement (false once a trial has expired). */
  entitled: boolean
  /** The clinic owner's switch. */
  enabled: boolean
  /** entitled AND enabled. */
  active: boolean
  /** Trial expiry (ISO) or null. */
  entitledUntil: string | null
  lockedReason: 'not_entitled' | 'trial_expired' | null
}

export interface ModuleFeatureGroup {
  module: string
  features: OrgFeature[]
}

// ─── Org feature management (super admin) ───────────────────────────

export async function fetchOrgFeatures(
  orgId: string,
): Promise<ModuleFeatureGroup[]> {
  const { data } = await api.get(`/feature-flags/org/${orgId}`)
  return data.data
}

export async function toggleFeature(
  orgId: string,
  featureKey: string,
  payload: { isEnabled: boolean },
): Promise<any> {
  const { data } = await api.patch(
    `/feature-flags/org/${orgId}/${featureKey}`,
    payload,
  )
  return data.data
}

export async function bulkToggleFeatures(
  orgId: string,
  payload: { featureKeys: string[]; isEnabled: boolean },
): Promise<any> {
  const { data } = await api.post(`/feature-flags/org/${orgId}/bulk`, payload)
  return data.data
}

export async function setEntitlement(
  orgId: string,
  featureKey: string,
  payload: { entitled: boolean; until?: string | null },
): Promise<any> {
  const { data } = await api.patch(
    `/feature-flags/org/${orgId}/${encodeURIComponent(featureKey)}/entitlement`,
    payload,
  )
  return data.data
}

export async function bulkSetEntitlement(
  orgId: string,
  payload: {
    featureKeys?: string[]
    module?: string
    entitled: boolean
    until?: string | null
  },
): Promise<{ updated: number }> {
  const { data } = await api.post(
    `/feature-flags/org/${orgId}/entitlement/bulk`,
    payload,
  )
  return data.data
}

export async function seedOrgFlags(orgId: string): Promise<any> {
  const { data } = await api.post(`/feature-flags/org/${orgId}/seed`)
  return data.data
}

// ─── Current user's enabled features ────────────────────────────────

export async function fetchMyFeatures(): Promise<string[]> {
  const { data } = await api.get('/feature-flags/my-features')
  return data.data
}
