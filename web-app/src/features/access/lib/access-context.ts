import { createContext } from 'react'
import { createAccessChecks } from './access'
import type { AccessChecks } from './access'

/**
 * - `disabled`: not signed in / no active location — nothing fetched
 * - `loading` / `error` / `ready`: state of the `/me/access` query
 */
export type AccessStatus = 'disabled' | 'loading' | 'error' | 'ready'

export interface AccessContextValue extends AccessChecks {
  status: AccessStatus
  isSuperAdmin: boolean
  isOwner: boolean
  employeeId: string | null
  homeRoute: string | null
  /** `/me/access` version the checks were built from (0 when none). */
  version: number
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export const DISABLED_ACCESS: AccessContextValue = {
  ...createAccessChecks(undefined),
  status: 'disabled',
  isSuperAdmin: false,
  isOwner: false,
  employeeId: null,
  homeRoute: null,
  version: 0,
  isLoading: false,
  isError: false,
  refetch: () => {},
}

export const AccessContext = createContext<AccessContextValue>(DISABLED_ACCESS)
