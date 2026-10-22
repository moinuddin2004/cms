import type { Permission } from '../generated/catalog'
import type { NavLayout } from '../nav/nav.registry'

/**
 * Permission key from the shared catalog (`../generated/catalog.ts`, written
 * by the backend's `npm run access:export`), so a typo fails at compile time.
 */
export type PermissionKey = Permission

/** Row-level reach of a scoped permission. */
export type Scope = 'own' | 'location' | 'org'

/** One permission, or several of which any one is enough. */
export type PermissionRequirement = PermissionKey | readonly PermissionKey[]

/** `GET /me/access` — the resolved access of the signed-in user. */
export interface MeAccess {
  /** `organizations.access_version`; bumps on every role/flag/layout change. */
  version: number
  organizationId: string
  locationId: string | null
  isSuperAdmin: boolean
  isOwner: boolean
  /** Enabled feature keys for the active org/location. */
  features: string[]
  /** Granted permissions only; a missing key means no access. */
  permissions: Partial<Record<PermissionKey, Scope | true>>
  roles: { id: string; name: string; templateKey: string | null }[]
  employeeId: string | null
  homeRoute: string | null
  /**
   * The clinic's sidebar layout (`nav_layouts`), or null to use the code
   * default. Arranges only — the sidebar still filters every item by `can`.
   */
  nav: NavLayout | null
}

/** Payload of the `access.changed` realtime event. */
export interface AccessChangedEvent {
  organizationId: string
  version: number
}
