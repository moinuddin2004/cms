import type { ApiResponse } from '@/core/types';
import { patientApi } from '@/patient/lib/api';

import type {
  BillingClinic,
  PatientAppointment,
  PatientPrescriptionDetail,
  PatientPrescription,
  PatientVisit,
  RecordPage,
} from '../types/records.types';

export const RECORDS_PAGE_SIZE = 20;

const params = (profileId: string | null, extra: Record<string, unknown> = {}) => ({
  ...(profileId ? { profileId } : {}),
  ...extra,
});

/** `GET /patient-api/appointments` — newest first, max 300, not paged. */
export async function fetchAppointments(profileId: string | null): Promise<PatientAppointment[]> {
  const res = await patientApi.get<ApiResponse<PatientAppointment[]>>('/patient-api/appointments', {
    params: params(profileId),
  });
  return res.data.data;
}

/** `GET /patient-api/visits` (completed consultations only). */
export async function fetchVisits(profileId: string | null, page: number) {
  const res = await patientApi.get<ApiResponse<RecordPage<PatientVisit>>>('/patient-api/visits', {
    params: params(profileId, { page, limit: RECORDS_PAGE_SIZE }),
  });
  return res.data.data;
}

export async function fetchPrescriptions(profileId: string | null, page: number) {
  const res = await patientApi.get<ApiResponse<RecordPage<PatientPrescription>>>(
    '/patient-api/prescriptions',
    { params: params(profileId, { page, limit: RECORDS_PAGE_SIZE }) },
  );
  return res.data.data;
}

export async function fetchPrescription(id: string): Promise<PatientPrescriptionDetail> {
  const res = await patientApi.get<ApiResponse<PatientPrescriptionDetail>>(
    `/patient-api/prescriptions/${encodeURIComponent(id)}`,
  );
  return res.data.data;
}

/** `GET /patient-api/billing/summary` — only clinics with billing shown. */
export async function fetchBilling(profileId: string | null): Promise<BillingClinic[]> {
  const res = await patientApi.get<ApiResponse<BillingClinic[]>>('/patient-api/billing/summary', {
    params: params(profileId),
  });
  return res.data.data;
}
