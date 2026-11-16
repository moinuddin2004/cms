import { useEffect } from 'react';

import type { PushData } from '@/core/notifications/push-data';
import { subscribeToPushTaps } from '@/core/notifications/tap-events';
import { switchSpace } from '@/core/space/switch-space';
import { useSpaceStore, type Space } from '@/core/space/useSpaceStore';
import { handlePatientNotificationRoute, isPatientSignedIn } from '@/patient';
import { handleStaffNotificationRoute, isStaffSignedIn } from '@/staff';

/** Everything the router touches, injectable so the tap rules are testable without native code. */
export interface NotificationRouterDeps {
  getActiveSpace: () => Space | null;
  switchSpace: (space: Space | null) => void;
  isStaffSignedIn: () => Promise<boolean>;
  handleStaff: (data: PushData) => void;
  isPatientSignedIn: () => Promise<boolean>;
  handlePatient: (data: PushData) => void;
}

/**
 * Routes a tapped push (docs/02 §8). Warm and cold taps both end here.
 *
 * - staff push, staff signed in → make staff the active space (if it is not) and let it route
 * - staff push, staff not signed in → open the staff sign-in; the tap is dropped, never replayed
 *   for whoever signs in next
 * - patient push: same rules for the patient space (switch, then park the tap for its layout; not
 *   signed in → its sign-in, tap dropped)
 *
 * The payload is only a routing hint — screens and the API still enforce access (docs/03 §2.4).
 */
export function createNotificationRouter(deps: NotificationRouterDeps) {
  return async function routeNotification(data: PushData): Promise<void> {
    if (data.space === 'patient') {
      const patientIn = await deps.isPatientSignedIn();
      if (deps.getActiveSpace() !== 'patient') deps.switchSpace('patient');
      if (patientIn) deps.handlePatient(data);
      return;
    }
    if (data.space !== 'staff') return;
    const signedIn = await deps.isStaffSignedIn();
    if (deps.getActiveSpace() !== 'staff') deps.switchSpace('staff');
    if (signedIn) deps.handleStaff(data);
  };
}

const routeNotification = createNotificationRouter({
  getActiveSpace: () => useSpaceStore.getState().activeSpace,
  switchSpace,
  isStaffSignedIn,
  handleStaff: handleStaffNotificationRoute,
  isPatientSignedIn,
  handlePatient: handlePatientNotificationRoute,
});

/** Mounted once in the root shell: listens for taps for as long as the app runs. */
export function useNotificationTaps(): void {
  useEffect(() => subscribeToPushTaps((data) => void routeNotification(data)), []);
}
