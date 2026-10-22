import { useEffect, useMemo, useState } from 'react'
import type {
  Permission,
  PermissionMap,
} from '@/features/access/generated/catalog'
import { highRiskAdded, sameGrants } from '../lib/bundles'
import { roleError } from '../lib/role-errors'
import type { RoleError } from '../lib/role-errors'
import type { RoleDetail } from '../types/roles.types'
import { useUpdateRole } from './useRoles'

/** A change waiting for the high-risk reason dialog. */
export interface PendingRiskyChange {
  next: PermissionMap
  permissions: Permission[]
}

/**
 * Draft of a role's permissions + home page. Granting a high-risk permission
 * first goes through a reason dialog (`pending`); the collected reason is
 * sent with the save and kept in the audit log.
 */
export function useRoleEditor(role: RoleDetail | undefined) {
  const [permissions, setPermissions] = useState<PermissionMap>({})
  const [homeRoute, setHomeRoute] = useState<string | null>(null)
  const [reasons, setReasons] = useState<string[]>([])
  const [pending, setPending] = useState<PendingRiskyChange | null>(null)
  const [error, setError] = useState<RoleError | null>(null)
  const update = useUpdateRole(role?.id ?? '')

  // Re-seed whenever a (new version of the) role arrives.
  useEffect(() => {
    if (!role) return
    setPermissions(role.permissions)
    setHomeRoute(role.homeRoute)
    setReasons([])
    setError(null)
  }, [role])

  const original = role?.permissions ?? {}
  const permissionsDirty = !!role && !sameGrants(original, permissions)
  const homeDirty = !!role && (role.homeRoute ?? null) !== homeRoute
  const dirty = permissionsDirty || homeDirty

  /** Apply a permission change; new high-risk grants ask for a reason first. */
  const change = (next: PermissionMap) => {
    // Re-ticking something the saved role already had needs no reason.
    const newVsSaved = highRiskAdded(original, next)
    const risky = highRiskAdded(permissions, next).filter((p) =>
      newVsSaved.includes(p),
    )
    if (risky.length) setPending({ next, permissions: risky })
    else setPermissions(next)
  }

  const confirmPending = (reason: string) => {
    if (!pending) return
    setPermissions(pending.next)
    setReasons((r) => [...r, reason.trim()])
    setPending(null)
  }

  const reset = () => {
    if (!role) return
    setPermissions(role.permissions)
    setHomeRoute(role.homeRoute)
    setReasons([])
    setError(null)
  }

  const needsReason = useMemo(
    () => highRiskAdded(original, permissions).length > 0,
    [original, permissions],
  )

  const save = async () => {
    if (!role || !dirty) return
    setError(null)
    try {
      await update.mutateAsync({
        ...(permissionsDirty ? { permissions } : {}),
        ...(homeDirty ? { homeRoute } : {}),
        ...(needsReason && reasons.length
          ? { reason: reasons.join(' · ') }
          : {}),
      })
    } catch (err) {
      setError(roleError(err))
    }
  }

  return {
    permissions,
    homeRoute,
    setHomeRoute,
    change,
    pending,
    confirmPending,
    cancelPending: () => setPending(null),
    dirty,
    reset,
    save,
    isSaving: update.isPending,
    error,
  }
}
