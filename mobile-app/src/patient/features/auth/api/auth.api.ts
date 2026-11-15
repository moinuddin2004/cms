import { patientApi } from '@/patient/lib/api';
import { getRefreshToken } from '@/patient/lib/session';
import type { PatientSessionPayload } from '@/patient/store/usePatientAuthStore';

import { PRIVACY_VERSION, TERMS_VERSION } from '../lib/legal-versions';

/** Ask for a login code. The API always answers `{ sent: true }` (it never reveals whether an account exists). */
export async function startEmail(email: string): Promise<void> {
  await patientApi.post('/patient-auth/email/start', { email });
}

/** Trade the emailed code for a session. The first sign-in records consent to these versions. */
export async function verifyEmail(email: string, code: string): Promise<PatientSessionPayload> {
  const { data } = await patientApi.post('/patient-auth/email/verify', {
    email,
    code,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
  });
  return data.data;
}

/** Revoke this device's session on the server. Best effort — the caller signs out locally either way. */
export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return;
  await patientApi.post(
    '/patient-auth/logout',
    {},
    { headers: { 'x-patient-refresh-token': refreshToken } },
  );
}

/** Save the account's display name (asked once after the first sign-in). */
export async function updateMyName(fullName: string): Promise<void> {
  await patientApi.patch('/patient-api/me', { fullName });
}
