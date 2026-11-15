import type { PushData } from '@/core/notifications/push-data';
import { getRefreshToken } from '@/staff/lib/session';

import { usePushRouteStore } from '../store/usePushRouteStore';

/**
 * Staff entry for a tapped push (called by `shell/notification-router.ts`). Warm or cold start, the
 * session may not be restored yet, so the tap is parked and `PushRoutePrompt` acts on it as soon as
 * the signed-in layout is up.
 */
export function handleStaffNotificationRoute(data: PushData): void {
  usePushRouteStore.getState().setPending(data);
}

/** Whether a staff session can be restored on this phone (a refresh token is stored). */
export async function isStaffSignedIn(): Promise<boolean> {
  return (await getRefreshToken()) !== null;
}
