import type { ApiResponse } from '@/core/types';
import { patientApi } from '@/patient/lib/api';

import type { LinkHistoryEntry, PatientLink } from '../types/clinics.types';

export async function fetchLinks(): Promise<PatientLink[]> {
  const res = await patientApi.get<ApiResponse<PatientLink[]>>('/patient-api/links');
  return res.data.data;
}

/** Patient-side revoke: the clinic's records leave the app, the clinic keeps its own. */
export async function unlinkClinic(linkId: string): Promise<void> {
  await patientApi.delete(`/patient-api/links/${encodeURIComponent(linkId)}`);
}

export async function fetchLinkHistory(linkId: string): Promise<LinkHistoryEntry[]> {
  const res = await patientApi.get<ApiResponse<LinkHistoryEntry[]>>(
    `/patient-api/links/${encodeURIComponent(linkId)}/history`,
  );
  return res.data.data;
}
