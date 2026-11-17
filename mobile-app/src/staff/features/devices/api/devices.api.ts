import type { ApiResponse } from '@/core/types';
import { staffApi } from '@/staff/lib/api';

export interface DeviceRegistration {
  expoPushToken: string;
  platform: 'android' | 'ios';
  /** The app build that registered the token (`appVersion`, required by the API, max 20 chars). */
  appVersion: string;
  /** Phone model only — never the owner's name (max 80 chars). */
  deviceLabel?: string;
}

/** `POST /me/devices` — upsert by token (a token moves to the calling user). */
export async function registerDevice(body: DeviceRegistration): Promise<{ id: string }> {
  const res = await staffApi.post<ApiResponse<{ id: string }>>('/me/devices', body);
  return res.data.data;
}

/** Sign-out waits on the DELETE, so it gets a short timeout (the client default is 15 s). */
export const UNREGISTER_TIMEOUT_MS = 4_000;

/** `DELETE /me/devices` — the token travels in the request body. */
export async function unregisterDevice(expoPushToken: string): Promise<{ deleted: number }> {
  const res = await staffApi.delete<ApiResponse<{ deleted: number }>>('/me/devices', {
    data: { expoPushToken },
    timeout: UNREGISTER_TIMEOUT_MS,
  });
  return res.data.data;
}

/**
 * `POST /auth/devices/unregister` — no session needed: finishes an unregister that a sign-out could
 * not send (offline, or a forced sign-out whose token was already dead). The push token is the
 * credential (device-specific, unguessable). NOTE: the backend route does not exist yet (audit M4,
 * backend half); until it does this call fails and the token is kept for the next start.
 */
export async function unregisterDeviceWithoutSession(expoPushToken: string): Promise<void> {
  await staffApi.post('/auth/devices/unregister', { expoPushToken }, { timeout: UNREGISTER_TIMEOUT_MS });
}
