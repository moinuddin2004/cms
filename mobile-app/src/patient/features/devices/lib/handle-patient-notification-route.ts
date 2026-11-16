import type { PushData } from '@/core/notifications/push-data';
import { getRefreshToken } from '@/patient/lib/session';

import { usePatientPushRouteStore } from '../store/usePatientPushRouteStore';

/** Patient entry for a tapped push (called by `shell/notification-router.ts`); parks it for `PatientPushRoute`. */
export function handlePatientNotificationRoute(data: PushData): void {
  usePatientPushRouteStore.getState().setPending(data);
}

/** Whether a patient session can be restored on this phone (a refresh token is stored). */
export async function isPatientSignedIn(): Promise<boolean> {
  return (await getRefreshToken()) !== null;
}
