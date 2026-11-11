import { create } from 'zustand';

export type AccessSource = 'super_admin' | 'owner' | 'employee';

export type SignInBlockCode =
  | 'CLINIC_PENDING_APPROVAL'
  | 'CLINIC_REJECTED'
  | 'GOOGLE_SIGN_IN_REQUIRED'
  | 'GOOGLE_SIGN_IN_DISABLED'
  | 'GOOGLE_DOMAIN_NOT_ALLOWED';

export interface SignInBlock {
  code: SignInBlockCode;
  message: string;
}

export interface Location {
  id: string;
  name: string;
  code: string;
  isMainBranch: boolean;
  accessSource: AccessSource;
  isPrimary: boolean;
  /** IANA timezone from `locations.timezone`; every clinic date/time is shown in it. */
  timezone?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  accessSource: AccessSource;
  specialtyTags: string[];
  /** ISO 4217 code money is shown in. */
  currency?: string;
  locations: Location[];
  /** Why this session can't open the clinic; null/absent when it can. */
  signInBlock?: SignInBlock | null;
}

export interface User {
  uuid: string;
  userUuid?: string;
  email: string;
  name: string;
  globalRole: string | null;
  avatarUrl?: string;
  emailVerificationPending?: boolean;
  emailVerificationDueAt?: string | null;
}

/**
 * - `restoring`: app start, trying the stored refresh token
 * - `unreachable`: a stored session exists but the API can't be reached
 * - `signedOut` / `signedIn`
 */
export type SessionStatus = 'restoring' | 'unreachable' | 'signedOut' | 'signedIn';

/** The session payload of /auth/login and /auth/refresh. */
export interface SessionPayload {
  user: User;
  accessToken: string;
  /** Native clients only: `sessionId:token`, kept in SecureStore. */
  refreshToken?: string;
  isSuperAdmin: boolean;
  accessSource: AccessSource | null;
  requiresOrgSelection: boolean;
  requiresLocationSelection: boolean;
  accessibleOrganizations: Organization[];
  activeOrganizationId: string | null;
  activeLocationId: string | null;
}

interface AuthState {
  status: SessionStatus;
  user: User | null;
  /** Memory only — never persisted. */
  accessToken: string | null;
  isSuperAdmin: boolean;
  accessSource: AccessSource | null;
  requiresOrgSelection: boolean;
  requiresLocationSelection: boolean;
  accessibleOrganizations: Organization[];
  activeOrganizationId: string | null;
  activeLocationId: string | null;
  /** API refused this account with EMAIL_NOT_VERIFIED. */
  emailVerificationRequired: boolean;

  setSession: (data: SessionPayload) => void;
  setStatus: (status: SessionStatus) => void;
  setLocationContext: (orgId: string, locationId: string) => void;
  setClinicBlock: (orgId: string, block: SignInBlock) => void;
  setEmailVerificationRequired: (required: boolean) => void;
  requestClinicSelection: () => void;
  clearAuth: () => void;
}

const signedOutState = {
  user: null,
  accessToken: null,
  isSuperAdmin: false,
  accessSource: null,
  requiresOrgSelection: false,
  requiresLocationSelection: false,
  accessibleOrganizations: [],
  activeOrganizationId: null,
  activeLocationId: null,
  emailVerificationRequired: false,
} satisfies Partial<AuthState>;

/**
 * Staff auth store — memory only. The refresh token is in SecureStore
 * (`@/staff/lib/session`), written by `@/staff/lib/api`.
 */
export const useStaffAuthStore = create<AuthState>()((set) => ({
  status: 'restoring',
  ...signedOutState,

  setSession: (d) =>
    set({
      status: 'signedIn',
      user: {
        uuid: d.user.uuid || d.user.userUuid || '',
        email: d.user.email,
        name: d.user.name,
        globalRole: d.user.globalRole || null,
        avatarUrl: d.user.avatarUrl,
        emailVerificationPending: d.user.emailVerificationPending ?? false,
        emailVerificationDueAt: d.user.emailVerificationDueAt ?? null,
      },
      accessToken: d.accessToken,
      isSuperAdmin: d.isSuperAdmin || false,
      accessSource: d.accessSource || null,
      requiresOrgSelection: d.requiresOrgSelection || false,
      requiresLocationSelection: d.requiresLocationSelection || false,
      accessibleOrganizations: d.accessibleOrganizations || [],
      activeOrganizationId: d.activeOrganizationId || null,
      activeLocationId: d.activeLocationId || null,
    }),

  setStatus: (status) => set({ status }),

  setLocationContext: (orgId, locationId) =>
    set({
      activeOrganizationId: orgId,
      activeLocationId: locationId,
      requiresOrgSelection: false,
      requiresLocationSelection: false,
    }),

  setClinicBlock: (orgId, block) =>
    set((s) => ({
      accessibleOrganizations: s.accessibleOrganizations.map((o) =>
        o.id === orgId ? { ...o, signInBlock: block } : o,
      ),
    })),

  setEmailVerificationRequired: (required) => set({ emailVerificationRequired: required }),

  requestClinicSelection: () =>
    set({ requiresOrgSelection: true, activeOrganizationId: null, activeLocationId: null }),

  clearAuth: () => set({ status: 'signedOut', ...signedOutState }),
}));

type Picked = Pick<AuthState, 'accessibleOrganizations' | 'activeOrganizationId'>;

/** The active clinic, if any. */
export function activeOrganization(s: Picked): Organization | null {
  return s.accessibleOrganizations.find((o) => o.id === s.activeOrganizationId) ?? null;
}

/** The active clinic's block for this session, if it can't be opened. */
export function activeClinicBlock(s: Picked): SignInBlock | null {
  return activeOrganization(s)?.signInBlock ?? null;
}

/** Signed in but must still pick a clinic / location. */
export function needsLocationSelection(
  s: Pick<
    AuthState,
    'requiresOrgSelection' | 'requiresLocationSelection' | 'activeOrganizationId' | 'activeLocationId'
  >,
): boolean {
  return (
    s.requiresOrgSelection ||
    s.requiresLocationSelection ||
    !s.activeOrganizationId ||
    !s.activeLocationId
  );
}
