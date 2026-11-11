import { staffApi } from '@/staff/lib/api';
import { getRefreshToken } from '@/staff/lib/session';
import type { SessionPayload } from '@/staff/store/useStaffAuthStore';

import type { LoginFormValues } from '../schemas/auth.schema';

export async function login(values: LoginFormValues): Promise<SessionPayload> {
  const { data } = await staffApi.post('/auth/login', values);
  return data.data;
}

/** Pick the clinic + location after login. */
export async function selectLocation(organizationId: string, locationId: string) {
  const { data } = await staffApi.post('/auth/select-location', { organizationId, locationId });
  return data.data as { activeOrganizationId: string; activeLocationId: string };
}

/** Move an open session to another clinic / location (same body and reply as `selectLocation`). */
export async function switchLocation(organizationId: string, locationId: string) {
  const { data } = await staffApi.post('/auth/switch-location', { organizationId, locationId });
  return data.data as { activeOrganizationId: string; activeLocationId: string };
}

/** Revoke this device's session on the server. Best effort — the caller signs out locally either way. */
export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  await staffApi.post(
    '/auth/logout',
    {},
    refreshToken ? { headers: { 'x-refresh-token': refreshToken } } : undefined,
  );
}
