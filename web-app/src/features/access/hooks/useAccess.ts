import { useContext } from 'react'
import { AccessContext } from '../lib/access-context'
import type { AccessContextValue } from '../lib/access-context'

/**
 * The one question the UI asks: `can(perm)`. Never branch on role names —
 * owners and super admins simply arrive with the full catalog granted.
 */
export function useAccess(): AccessContextValue {
  return useContext(AccessContext)
}
