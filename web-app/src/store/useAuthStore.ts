import { create } from 'zustand'

interface Organization {
  id: string
  name: string
  slug: string
  accessSource: 'super_admin' | 'owner' | 'employee'
  specialtyTags: string[]
  /** ISO 4217 code money is shown in; older sessions may lack it. */
  currency?: string
  locations: Location[]
}

interface Location {
  id: string
  name: string
  code: string
  isMainBranch: boolean
  accessSource: 'super_admin' | 'owner' | 'employee'
  isPrimary: boolean
}

/** A lab the user works in (from login / refresh / me). */
export interface LabMembership {
  labId: string
  labName: string
  labType: 'external' | 'internal'
  city: string | null
  role: 'lab_admin' | 'lab_technician'
}

export interface User {
  uuid: string
  userUuid?: string
  email: string
  name: string
  globalRole: string | null
  avatarUrl?: string
  /** Self-signup that hasn't clicked the verification link yet. */
  emailVerificationPending?: boolean
}

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean

  // Access context
  isSuperAdmin: boolean
  accessSource: 'super_admin' | 'owner' | 'employee' | null
  requiresOrgSelection: boolean
  requiresLocationSelection: boolean
  accessibleOrganizations: Organization[]
  activeOrganizationId: string | null
  activeLocationId: string | null

  // Lab portal context — sent as x-lab-id on /lab-portal requests only
  labMemberships: LabMembership[]
  activeLabId: string | null

  setAuth: (data: {
    user: User
    accessToken: string
    isSuperAdmin?: boolean
    accessSource?: 'super_admin' | 'owner' | 'employee' | null
    requiresOrgSelection?: boolean
    requiresLocationSelection?: boolean
    accessibleOrganizations?: Organization[]
    activeOrganizationId?: string | null
    activeLocationId?: string | null
    labMemberships?: LabMembership[]
  }) => void

  setAccessToken: (token: string) => void

  setLocationContext: (orgId: string, locId: string) => void

  setActiveLab: (labId: string) => void

  clearAuth: () => void
}

/**
 * Auth store — memory only, NO persist/localStorage.
 * Access token lives only in Zustand memory.
 * Refresh token lives only in httpOnly cookie (handled by browser).
 */
export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  isSuperAdmin: false,
  accessSource: null,
  requiresOrgSelection: false,
  requiresLocationSelection: false,
  accessibleOrganizations: [],
  activeOrganizationId: null,
  activeLocationId: null,
  labMemberships: [],
  activeLabId: null,

  setAuth: (data) => {
    const labs = data.labMemberships ?? []
    const current = get().activeLabId
    set({
      user: {
        uuid: data.user.uuid || data.user.userUuid || '',
        email: data.user.email,
        name: data.user.name,
        globalRole: data.user.globalRole || null,
        avatarUrl: data.user.avatarUrl,
      },
      accessToken: data.accessToken,
      isAuthenticated: true,
      isSuperAdmin: data.isSuperAdmin || false,
      accessSource: data.accessSource || null,
      requiresOrgSelection: data.requiresOrgSelection || false,
      requiresLocationSelection: data.requiresLocationSelection || false,
      accessibleOrganizations: data.accessibleOrganizations || [],
      activeOrganizationId: data.activeOrganizationId || null,
      activeLocationId: data.activeLocationId || null,
      labMemberships: labs,
      // Keep the chosen lab across token refreshes while it is still valid
      activeLabId: labs.some((l) => l.labId === current)
        ? current
        : (labs[0]?.labId ?? null),
    })
  },

  setAccessToken: (token) => set({ accessToken: token }),

  setLocationContext: (orgId, locId) =>
    set({
      activeOrganizationId: orgId,
      activeLocationId: locId,
      requiresOrgSelection: false,
      requiresLocationSelection: false,
    }),

  setActiveLab: (labId) => set({ activeLabId: labId }),

  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isSuperAdmin: false,
      accessSource: null,
      requiresOrgSelection: false,
      requiresLocationSelection: false,
      accessibleOrganizations: [],
      activeOrganizationId: null,
      activeLocationId: null,
      labMemberships: [],
      activeLabId: null,
    }),
}))

/**
 * Lab-only users (lab staff with no clinic organization) live in the lab
 * portal: login and the root guard send them to /lab-portal.
 */
export function isLabOnlyUser(
  s: Pick<
    AuthState,
    'isSuperAdmin' | 'accessibleOrganizations' | 'labMemberships'
  >,
): boolean {
  return (
    !s.isSuperAdmin &&
    s.accessibleOrganizations.length === 0 &&
    s.labMemberships.length > 0
  )
}
