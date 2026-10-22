/** Why the owner cannot switch a feature on. */
export type FeatureLockedReason = 'not_entitled' | 'trial_expired'

/** One feature on the owner's Features page (`GET /admin/features`). */
export interface OwnerFeature {
  key: string
  name: string
  module: string
  description: string | null
  specialtyTags: string[]
  enabledByDefault: boolean
  sortOrder: number
  /** Super admin's entitlement (false once a trial has expired). */
  entitled: boolean
  /** The owner's switch. */
  enabled: boolean
  /** entitled ∧ enabled. */
  active: boolean
  entitledUntil: string | null
  lockedReason: FeatureLockedReason | null
  permissionCount: number
  /** Locations where the owner switched this feature off. */
  disabledLocationIds: string[]
}

export interface OwnerFeatureModule {
  module: string
  features: OwnerFeature[]
}

export interface OwnerFeaturesView {
  modules: OwnerFeatureModule[]
  locations: { id: string; name: string }[]
}

/** What switching a feature off takes away (`GET /admin/features/:key/impact`). */
export interface FeatureImpact {
  featureKey: string
  name: string
  permissions: { key: string; label: string; group: string }[]
  roles: { id: string; name: string; permissions: string[] }[]
}

export type FeatureStatusFilter = 'all' | 'on' | 'off' | 'locked'

export interface FeatureFilters {
  search: string
  module: string
  status: FeatureStatusFilter
}
