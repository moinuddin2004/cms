import type {
  MeAccess,
  PermissionKey,
  PermissionRequirement,
  Scope,
} from '../types/access.types'

export interface AccessChecks {
  /** Any-of: true when at least one listed permission is granted. No requirement → true. */
  can: (perm?: PermissionRequirement | null) => boolean
  /** All-of: true only when every listed permission is granted. */
  canAll: (perms: readonly PermissionKey[]) => boolean
  /**
   * Row-level reach of a granted permission, or null when not granted.
   * An unscoped grant (`true`) is unrestricted, so it reads as 'org'.
   */
  scope: (perm: PermissionKey) => Scope | null
  features: ReadonlySet<string>
  hasFeature: (key: string) => boolean
}

/**
 * Pure checks over a `/me/access` payload. `allowAll` is the super-admin
 * fallback used only when no payload exists (e.g. a super admin on a setup
 * page with no location yet); a loaded payload is always the source of truth.
 */
export function createAccessChecks(
  data: MeAccess | undefined,
  { allowAll = false }: { allowAll?: boolean } = {},
): AccessChecks {
  const permissions = data?.permissions ?? {}
  const features = new Set(data?.features ?? [])
  const fallback = !data && allowAll

  const scope = (perm: PermissionKey): Scope | null => {
    if (fallback) return 'org'
    const grant = permissions[perm] as Scope | true | undefined
    if (grant === undefined) return null
    return grant === true ? 'org' : grant
  }
  const has = (perm: PermissionKey) => scope(perm) !== null

  return {
    can: (perm) => {
      if (perm == null) return true
      if (typeof perm === 'string') return has(perm)
      return perm.length === 0 || perm.some(has)
    },
    canAll: (perms) => perms.every(has),
    scope,
    features,
    hasFeature: (key) => fallback || features.has(key),
  }
}
