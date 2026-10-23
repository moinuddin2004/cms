import type { ReactNode } from 'react'
import { useAccess } from '../hooks/useAccess'
import type {
  PermissionKey,
  PermissionRequirement,
} from '../types/access.types'

/** Renders children when ANY of the given permissions is granted. */
export function Can({
  perm,
  fallback = null,
  children,
}: {
  perm: PermissionRequirement
  fallback?: ReactNode
  children: ReactNode
}) {
  const { can } = useAccess()
  return <>{can(perm) ? children : fallback}</>
}

/** Renders children only when ALL of the given permissions are granted. */
export function CanAll({
  perms,
  fallback = null,
  children,
}: {
  perms: readonly PermissionKey[]
  fallback?: ReactNode
  children: ReactNode
}) {
  const { canAll } = useAccess()
  return <>{canAll(perms) ? children : fallback}</>
}
