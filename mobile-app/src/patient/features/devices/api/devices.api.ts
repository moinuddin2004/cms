import type { ApiResponse } from '@/core/types';
import { patientApi } from '@/patient/lib/api';

export interface PatientDeviceRegistration {
  expoPushToken: string;
  platform: 'android' | 'ios';
  /** The app build that registered the token (required by the API, max 20 chars). */
  appVersion: string;
  /** Phone model only, never the owner's name (max 80 chars). */
  deviceLabel?: string;
}

/** `POST /patient-api/devices` — upsert by token (a token moves to the calling account). */
export async function registerDevice(body: PatientDeviceRegistration): Promise<{ id: string }> {
  const res = await patientApi.post<ApiResponse<{ id: string }>>('/patient-api/devices', body);
  return res.data.data;
}

/** Sign-out waits on the DELETE, so it gets a short timeout (the client default is 15 s). */
export const UNREGISTER_TIMEOUT_MS = 4_000;

/** `DELETE /patient-api/devices` — the token travels in the request body. */
export async function unregisterDevice(expoPushToken: string): Promise<{ deleted: boolean }> {
  const res = await patientApi.delete<ApiResponse<{ deleted: boolean }>>('/patient-api/devices', {
    data: { expoPushToken },
    timeout: UNREGISTER_TIMEOUT_MS,
  });
  return res.data.data;
}
