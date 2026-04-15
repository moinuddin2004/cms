import apiClient from '@/lib/api';
import type {
  Patient,
  PaginatedResponse,
  ApiResponse,
  PatientListParams,
  PatientFormData,
} from '../types';

/**
 * Patient API service — all API calls are centralized here.
 * Components should never import apiClient directly.
 */

export async function fetchPatients(
  params: PatientListParams,
): Promise<PaginatedResponse<Patient>> {
  const response = await apiClient.get<ApiResponse<PaginatedResponse<Patient>>>(
    '/patients',
    { params },
  );
  return response.data.data;
}

export async function fetchPatient(id: string): Promise<Patient> {
  const response = await apiClient.get<ApiResponse<Patient>>(
    `/patients/${id}`,
  );
  return response.data.data;
}

export async function createPatient(
  data: PatientFormData,
): Promise<Patient> {
  // Clean empty strings to undefined
  const cleaned = cleanFormData(data);
  const response = await apiClient.post<ApiResponse<Patient>>(
    '/patients',
    cleaned,
  );
  return response.data.data;
}

export async function updatePatient(
  id: string,
  data: PatientFormData,
): Promise<Patient> {
  const cleaned = cleanFormData(data);
  const response = await apiClient.put<ApiResponse<Patient>>(
    `/patients/${id}`,
    cleaned,
  );
  return response.data.data;
}

export async function deactivatePatient(id: string): Promise<Patient> {
  const response = await apiClient.patch<ApiResponse<Patient>>(
    `/patients/${id}/deactivate`,
  );
  return response.data.data;
}

export async function checkPhoneUnique(
  phone: string,
  excludeId?: string,
): Promise<boolean> {
  const params = excludeId ? { excludeId } : {};
  const response = await apiClient.get<
    ApiResponse<{ exists: boolean }>
  >(`/patients/check-phone/${encodeURIComponent(phone)}`, { params });
  return !response.data.data.exists;
}

/**
 * Strips empty strings and converts them to undefined
 * so the backend receives clean data.
 */
function cleanFormData(data: PatientFormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === '' || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    result[key] = value;
  }
  return result;
}
