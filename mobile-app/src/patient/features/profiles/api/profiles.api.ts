import type { ApiResponse } from '@/core/types';
import { patientApi } from '@/patient/lib/api';

import type { CreateProfileInput, Profile, UpdateProfileInput } from '../types/profiles.types';

export async function fetchProfiles(): Promise<Profile[]> {
  const res = await patientApi.get<ApiResponse<Profile[]>>('/patient-api/profiles');
  return res.data.data;
}

export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  const res = await patientApi.post<ApiResponse<Profile>>('/patient-api/profiles', input);
  return res.data.data;
}

export async function updateProfile(id: string, input: UpdateProfileInput): Promise<Profile> {
  const res = await patientApi.patch<ApiResponse<Profile>>(
    `/patient-api/profiles/${encodeURIComponent(id)}`,
    input,
  );
  return res.data.data;
}

export async function removeProfile(id: string): Promise<void> {
  await patientApi.delete(`/patient-api/profiles/${encodeURIComponent(id)}`);
}
