import type { ApiResponse } from '@/core/types';
import { staffApi } from '@/staff/lib/api';

import type { AppLinkStatus, ClaimTokenResult } from '../types/app-link.types';

const base = (patientId: string) => `/patients/${encodeURIComponent(patientId)}/app-link`;

export async function fetchAppLink(patientId: string): Promise<AppLinkStatus> {
  const res = await staffApi.get<ApiResponse<AppLinkStatus>>(base(patientId));
  return res.data.data;
}

/** Needs `patients.app_link.manage`. A new token invalidates older unused ones. */
export async function createClaimToken(patientId: string): Promise<ClaimTokenResult> {
  const res = await staffApi.post<ApiResponse<ClaimTokenResult>>(`${base(patientId)}/claim-token`);
  return res.data.data;
}

/** Needs `patients.app_link.manage`. */
export async function revokeAppLink(patientId: string): Promise<void> {
  await staffApi.delete(base(patientId), { data: {} });
}
