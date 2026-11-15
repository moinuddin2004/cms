import { create } from 'zustand';

/**
 * - `restoring`: space start, trying the stored refresh token
 * - `unreachable`: a stored session exists but the API can't be reached
 * - `signedOut` / `signedIn`
 */
export type PatientSessionStatus = 'restoring' | 'unreachable' | 'signedOut' | 'signedIn';

export interface PatientAccount {
  id: string;
  fullName: string | null;
  email: string;
}

/** The session payload of `/patient-auth/email/verify` and `/patient-auth/refresh` (docs/07 §5). */
export interface PatientSessionPayload {
  account: PatientAccount;
  accessToken: string;
  /** `sessionId:token` — SecureStore only. */
  refreshToken: string;
  isNewAccount: boolean;
  needsName: boolean;
}

interface PatientAuthState {
  status: PatientSessionStatus;
  account: PatientAccount | null;
  /** Memory only — never persisted. */
  accessToken: string | null;
  /** The account has no name yet: the app asks for one before the main screens. */
  needsName: boolean;
  /** Email a login code was sent to — memory only, so it never lands in a URL or in prefs. */
  pendingEmail: string | null;

  setSession: (data: PatientSessionPayload) => void;
  setStatus: (status: PatientSessionStatus) => void;
  setAccountName: (fullName: string) => void;
  setPendingEmail: (email: string | null) => void;
  clearAuth: () => void;
}

const signedOutState = {
  account: null,
  accessToken: null,
  needsName: false,
  pendingEmail: null,
} satisfies Partial<PatientAuthState>;

/**
 * Patient auth store — memory only. The refresh token is in SecureStore
 * (`@/patient/lib/session`), written by `@/patient/lib/api`.
 */
export const usePatientAuthStore = create<PatientAuthState>()((set) => ({
  status: 'restoring',
  ...signedOutState,

  setSession: (d) =>
    set({
      status: 'signedIn',
      account: { id: d.account.id, fullName: d.account.fullName, email: d.account.email },
      accessToken: d.accessToken,
      needsName: d.needsName,
      pendingEmail: null,
    }),

  setStatus: (status) => set({ status }),

  setAccountName: (fullName) =>
    set((s) => ({ account: s.account ? { ...s.account, fullName } : s.account, needsName: false })),

  setPendingEmail: (pendingEmail) => set({ pendingEmail }),

  clearAuth: () => set({ status: 'signedOut', ...signedOutState }),
}));
