import type { ApiResponse } from '@/core/types';
import { patientApi } from '@/patient/lib/api';

import type { AcceptClaimInput, AcceptClaimResult, ClaimPreview } from '../types/claims.types';

// The token is a bearer secret and travels in the path (docs/07): never log it
// and never put it in an error message.
const path = (token: string) => `/patient-api/claims/${encodeURIComponent(token)}`;

export async function fetchClaimPreview(token: string): Promise<ClaimPreview> {
  const res = await patientApi.get<ApiResponse<ClaimPreview>>(path(token));
  return res.data.data;
}

export async function acceptClaim(
  token: string,
  input: AcceptClaimInput,
): Promise<AcceptClaimResult> {
  const res = await patientApi.post<ApiResponse<AcceptClaimResult>>(`${path(token)}/accept`, input);
  return res.data.data;
}
