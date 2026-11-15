import type { PatientSessionStatus } from '@/patient/store/usePatientAuthStore';

/**
 * The screens the patient stack may show (docs/02 §4). Exactly one is available
 * at a time (one `Stack.Protected` guard per value).
 */
export type PatientRoute = 'offline' | 'sign-in' | 'verify-code' | 'name' | 'main';

export interface PatientRouteState {
  status: PatientSessionStatus;
  /** A login code was sent and is awaited. */
  awaitingCode: boolean;
  /** Signed in, but the account has no name yet. */
  needsName: boolean;
}

/**
 * Where the patient space goes next. Pure and unit-tested. `restoring` shows
 * sign-in because the native splash covers it.
 */
export function resolvePatientRoute(state: PatientRouteState): PatientRoute {
  if (state.status === 'unreachable') return 'offline';
  if (state.status !== 'signedIn') return state.awaitingCode ? 'verify-code' : 'sign-in';
  if (state.needsName) return 'name';
  return 'main';
}
