import { create } from 'zustand'

export interface Organization {
  id: string
  name: string
  slug: string
  accessSource: 'super_admin' | 'owner' | 'employee'
  specialtyTags: string[]
  /** ISO 4217 code money is shown in; older sessions may lack it. */
  currency?: string
  locations: Location[]
  /**
   * Why this session can't open the clinic (awaiting approval, rejected,
   * or its sign-in policy); null/absent when it can.
   */
  signInBlock?: SignInBlock | null
}

export type SignInBlockCode =
  | 'CLINIC_PENDING_APPROVAL'
  | 'CLINIC_REJECTED'
  | 'GOOGLE_SIGN_IN_REQUIRED'
  | 'GOOGLE_SIGN_IN_DISABLED'
  | 'GOOGLE_DOMAIN_NOT_ALLOWED'

export interface SignInBlock {
  code: SignInBlockCode
  message: string
}

interface Location {
  id: string
  name: string
  code: string
  isMainBranch: boolean
  accessSource: 'super_admin' | 'owner' | 'employee'
  isPrimary: boolean
  /** IANA timezone from `locations.timezone`; every clinic date/time is shown in it. */
  timezone?: string
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
  /** Password account whose email is not verified yet. */
  emailVerificationPending?: boolean
  /** Pending only: until when it may still be used unverified (ISO). */
  emailVerificationDueAt?: string | null
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
  /**
   * The API refused this account with EMAIL_NOT_VERIFIED (past its grace
   * date): the root guard shows /confirm-email until it is verified.
   */
  emailVerificationRequired: boolean

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

  /** After a location's timezone is changed in settings. */
  setLocationTimezone: (locationId: string, timezone: string) => void

  /** A tenant request was refused by the clinic gate (see lib/api). */
  setClinicBlock: (orgId: string, block: SignInBlock) => void
  setEmailVerificationRequired: (required: boolean) => void

  /** Send the user back to the clinic picker (from /clinic-access). */
  requestClinicSelection: () => void

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
  emailVerificationRequired: false,
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
        emailVerificationPending: data.user.emailVerificationPending ?? false,
        emailVerificationDueAt: data.user.emailVerificationDueAt ?? null,
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

  setLocationTimezone: (locationId, timezone) =>
    set((s) => ({
      accessibleOrganizations: s.accessibleOrganizations.map((o) => ({
        ...o,
        locations: o.locations.map((l) =>
          l.id === locationId ? { ...l, timezone } : l,
        ),
      })),
    })),

  setClinicBlock: (orgId, block) =>
    set((s) => ({
      accessibleOrganizations: s.accessibleOrganizations.map((o) =>
        o.id === orgId ? { ...o, signInBlock: block } : o,
      ),
    })),

  setEmailVerificationRequired: (required) =>
    set({ emailVerificationRequired: required }),

  requestClinicSelection: () =>
    set({
      requiresOrgSelection: true,
      activeOrganizationId: null,
      activeLocationId: null,
    }),

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
      emailVerificationRequired: false,
    }),
}))

/** The active clinic's block for this session, if it can't be opened. */
export function activeClinicBlock(
  s: Pick<AuthState, 'accessibleOrganizations' | 'activeOrganizationId'>,
): SignInBlock | null {
  return (
    s.accessibleOrganizations.find((o) => o.id === s.activeOrganizationId)
      ?.signInBlock ?? null
  )
}

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
