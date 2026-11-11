import { staffApi } from '@/staff/lib/api';

import type { MeAccess } from '../types/access.types';

/** Resolved access for the active org/location (headers set by the client). */
export async function fetchMyAccess(): Promise<MeAccess> {
  const { data } = await staffApi.get('/me/access');
  return data.data;
}
