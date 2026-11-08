import { isLabOnlyUser, useAuthStore } from '@/store/useAuthStore'
import type { Organization, LabMembership, User } from '@/store/useAuthStore'
import { saveRefreshToken } from '@/lib/desktop-session'

/** The session payload of /auth/login, /auth/register, /auth/google, … */
export interface LoginPayload {
  user: User
  accessToken: string
  /**
   * Desktop/native only: the API returns the `sessionId:refreshToken` value
   * in the body (a web build gets it in an httpOnly cookie instead).
   */
  refreshToken?: string
  isSuperAdmin: boolean
  accessSource: 'super_admin' | 'owner' | 'employee' | null
  requiresOrgSelection: boolean
  requiresLocationSelection: boolean
  accessibleOrganizations: Organization[]
  activeOrganizationId: string | null
  activeLocationId: string | null
  labMemberships?: LabMembership[]
}

/** Store a fresh session in the auth store. */
export function storeSession(d: LoginPayload) {
  // Every sign-in path goes through here, so this is the one place the
  // desktop build needs to persist its refresh token. No-op on the web.
  void saveRefreshToken(d.refreshToken)

  useAuthStore.getState().setAuth({
    user: d.user,
    accessToken: d.accessToken,
    isSuperAdmin: d.isSuperAdmin,
    accessSource: d.accessSource,
    requiresOrgSelection: d.requiresOrgSelection,
    requiresLocationSelection: d.requiresLocationSelection,
    accessibleOrganizations: d.accessibleOrganizations,
    activeOrganizationId: d.activeOrganizationId,
    activeLocationId: d.activeLocationId,
    labMemberships: d.labMemberships ?? [],
  })
}

/**
 * Where a freshly signed-in user goes: the lab portal, the clinic/location
 * picker, or `/` (the root guard sends a blocked or clinic-less session on
 * to /clinic-access).
 */
export function homeAfterLogin(d: LoginPayload): string {
  if (
    isLabOnlyUser({
      isSuperAdmin: d.isSuperAdmin,
      accessibleOrganizations: d.accessibleOrganizations ?? [],
      labMemberships: d.labMemberships ?? [],
    })
  ) {
    return '/lab-portal'
  }
  if (d.requiresOrgSelection || d.requiresLocationSelection) {
    return '/select-location'
  }
  return '/'
}

/** Axios error → the API's message (first one for validation arrays). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: unknown } } })?.response
    ?.data?.message
  if (Array.isArray(msg)) return String(msg[0])
  return typeof msg === 'string' && msg ? msg : fallback
}
