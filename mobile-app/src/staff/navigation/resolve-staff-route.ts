import type { SessionStatus } from '@/staff/store/useStaffAuthStore';

/**
 * The screens the staff stack may show (docs/02 §4). Exactly one is available
 * at a time: the space layout renders a `Stack.Protected` guard per value, so
 * a state change removes the old screen and Expo Router moves to the new one.
 */
export type StaffRoute = 'offline' | 'login' | 'select-location' | 'main';

export interface StaffRouteState {
  /** The staff auth store's session status. */
  status: SessionStatus;
  /** Signed in, but no clinic/location chosen yet. */
  mustSelectLocation: boolean;
  /** The active clinic refuses this session (approval / sign-in policy). */
  clinicBlocked: boolean;
}

/**
 * Where the staff space goes next. Pure and unit-tested (docs/09 §2): every
 * row of the guard table in docs/02 §4 maps to exactly one route.
 *
 * `restoring` shows login because the native splash covers it; the moment the
 * restore finishes, the same table moves the user on.
 */
export function resolveStaffRoute(state: StaffRouteState): StaffRoute {
  if (state.status === 'unreachable') return 'offline';
  if (state.status !== 'signedIn') return 'login'; // signedOut | restoring
  if (state.mustSelectLocation || state.clinicBlocked) return 'select-location';
  return 'main';
}
