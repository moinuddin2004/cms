import type { ApiResponse } from '@/core/types';
import { staffApi } from '@/staff/lib/api';

import { deadlineFromResponse } from '../lib/countdown';
import type { AppLinkStatus, ClaimTokenResult, IssuedClaim } from '../types/app-link.types';

const base = (patientId: string) => `/patients/${encodeURIComponent(patientId)}/app-link`;

export async function fetchAppLink(patientId: string): Promise<AppLinkStatus> {
  const res = await staffApi.get<ApiResponse<AppLinkStatus>>(base(patientId));
  return res.data.data;
}

/** Needs `patients.app_link.manage`. A new token invalidates older unused ones. */
export async function createClaimToken(patientId: string): Promise<IssuedClaim> {
  const res = await staffApi.post<ApiResponse<ClaimTokenResult>>(`${base(patientId)}/claim-token`);
  const data = res.data.data;
  const header = res.headers?.date;
  return {
    ...data,
    deadlineMs: deadlineFromResponse(data.expiresAt, typeof header === 'string' ? header : undefined, Date.now()),
  };
}

/** Needs `patients.app_link.manage`. */
export async function revokeAppLink(patientId: string): Promise<void> {
  await staffApi.delete(base(patientId), { data: {} });
}
