import type {
  BundleLevel,
  PermissionGroup,
  PermissionMap,
} from '@/features/access/generated/catalog'

export type { BundleLevel, PermissionGroup, PermissionMap }

/** A module's level on the segmented control; `custom` = matches no bundle. */
export type ModuleLevel = BundleLevel | 'custom'

/** `GET /admin/roles` row. */
export interface RoleSummary {
  id: string
  name: string
  slug: string
  description: string | null
  /** System template this role came from (`doctor`, …), null for custom roles. */
  templateKey: string | null
  homeRoute: string | null
  /** Read-only template role: clone it to customise. */
  isSystemRole: boolean
  isActive: boolean
  /** Granted permissions only. */
  permissions: PermissionMap
  /** Per module: matching bundle level, or null when custom. */
  bundles: Record<PermissionGroup, BundleLevel | null>
  /** Active assignments using this role. */
  memberCount: number
  createdAt: string
  updatedAt: string
}

/** One assignment (employee at a location) using the role. */
export interface RoleMember {
  assignmentId: string
  employeeId: string
  employeeName: string
  designation: string
  locationId: string
  locationName: string
  isActive: boolean
  hasPortalAccess: boolean
}

/** `GET /admin/roles/:id`. */
export interface RoleDetail extends RoleSummary {
  members: RoleMember[]
}

export interface CreateRoleInput {
  name: string
  description?: string | null
  permissions?: PermissionMap
  homeRoute?: string | null
  reason?: string
}

export interface UpdateRoleInput {
  name?: string
  description?: string | null
  isActive?: boolean
  permissions?: PermissionMap
  homeRoute?: string | null
  reason?: string
}

export interface CloneRoleInput {
  name?: string
  reason?: string
}

export type RoleKindFilter = 'all' | 'system' | 'custom'
