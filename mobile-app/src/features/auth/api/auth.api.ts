import { api } from '@/lib/api';
import { getRefreshToken } from '@/lib/secure-storage';
import type { SessionPayload } from '@/store/useAuthStore';

import type { LoginFormValues } from '../schemas/auth.schema';

export async function login(values: LoginFormValues): Promise<SessionPayload> {
  const { data } = await api.post('/auth/login', values);
  return data.data;
}

/** Pick the clinic + location after login. */
export async function selectLocation(organizationId: string, locationId: string) {
  const { data } = await api.post('/auth/select-location', { organizationId, locationId });
  return data.data as { activeOrganizationId: string; activeLocationId: string };
}

/** Revoke this device's session on the server. Best effort — the caller signs out locally either way. */
export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  await api.post('/auth/logout', {}, refreshToken ? { headers: { 'x-refresh-token': refreshToken } } : undefined);
}
