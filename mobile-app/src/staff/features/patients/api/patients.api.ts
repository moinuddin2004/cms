import type { ApiResponse } from '@/core/types';
import { staffApi } from '@/staff/lib/api';

import { patientQueryParams } from '../lib/patient-query';
import type {
  CheckPhoneResult,
  CreatePatientInput,
  PatientDetail,
  PatientHistory,
  PatientPage,
  PatientQuery,
  PatientTeethChart,
  PrescriptionPage,
  Vitals,
} from '../types/patients.types';

/** `GET /patients` — undefined query values are dropped by axios. */
export async function fetchPatients(query: PatientQuery): Promise<PatientPage> {
  const res = await staffApi.get<ApiResponse<PatientPage>>('/patients', { params: patientQueryParams(query) });
  return res.data.data;
}

export async function fetchPatient(patientId: string): Promise<PatientDetail> {
  const res = await staffApi.get<ApiResponse<PatientDetail>>(
    `/patients/${encodeURIComponent(patientId)}`,
  );
  return res.data.data;
}

export async function createPatient(input: CreatePatientInput): Promise<PatientDetail> {
  const res = await staffApi.post<ApiResponse<PatientDetail>>('/patients', input);
  return res.data.data;
}

export async function checkPatientPhone(
  phone: string,
  excludeId?: string,
): Promise<CheckPhoneResult> {
  const res = await staffApi.get<ApiResponse<CheckPhoneResult>>(
    `/patients/check-phone/${encodeURIComponent(phone)}`,
    { params: { excludeId } },
  );
  return res.data.data;
}

/** Needs `patients.clinical.view`. */
export async function fetchPatientHistory(patientId: string): Promise<PatientHistory> {
  const res = await staffApi.get<ApiResponse<PatientHistory>>(
    `/patients/${encodeURIComponent(patientId)}/history`,
  );
  return res.data.data;
}

/** Newest first; the first item is the latest vitals. Needs `patients.clinical.view`. */
export async function fetchPatientVitals(patientId: string): Promise<Vitals[]> {
  const res = await staffApi.get<ApiResponse<Vitals[]>>(
    `/patients/${encodeURIComponent(patientId)}/vitals`,
  );
  return res.data.data;
}

/** Needs `patients.clinical.view` + feature `patients.teeth_chart`. */
export async function fetchPatientTeethCharts(patientId: string): Promise<PatientTeethChart[]> {
  const res = await staffApi.get<ApiResponse<PatientTeethChart[]>>(
    `/patients/${encodeURIComponent(patientId)}/teeth-charts`,
  );
  return res.data.data;
}

/** Needs `patients.clinical.view` + feature `patients.prescriptions`. */
export async function fetchPatientPrescriptions(
  patientId: string,
  page = 1,
  limit = 20,
): Promise<PrescriptionPage> {
  const res = await staffApi.get<ApiResponse<PrescriptionPage>>(
    `/prescriptions/patient/${encodeURIComponent(patientId)}`,
    { params: { page, limit } },
  );
  return res.data.data;
}
