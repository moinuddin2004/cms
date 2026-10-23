import api from '@/lib/api'
import type {
  PaginatedResponse,
  Patient,
  PatientFormData,
  PatientListParams,
  PatientVisit,
  PatientDentalInfo,
  PatientTeethChart,
  PatientVitals,
  PatientTreatmentPlan,
  TreatmentPlanItem,
  PatientPrescription,
  PatientDocument,
  PatientConsent,
  PatientCommunication,
  PatientRecall,
  PatientReferral,
  PatientFeedback,
  PatientInsurance,
  Encounter,
  Treatment,
  TreatmentFormData,
  PatientHistory,
} from '../types'

// ─── Patients CRUD ──────────────────────────────────────────────────

export async function fetchPatients(
  params: PatientListParams,
): Promise<PaginatedResponse<Patient>> {
  const { data } = await api.get('/patients', { params })
  return data.data // response is PaginatedResponseDto
}

export async function fetchPatientById(id: string): Promise<Patient> {
  const { data } = await api.get(`/patients/${id}`)
  return data.data // data.data is the actual Patient
}

export async function createPatient(
  payload: PatientFormData,
): Promise<Patient> {
  // Optional fields left blank in the form are '' — the API validates those
  // (`dob` IsDateString, `email` IsEmail) and would refuse the whole request.
  const body = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== ''),
  ) as unknown as PatientFormData
  const { data } = await api.post('/patients', body)
  return data.data
}

export async function updatePatient(
  id: string,
  payload: Partial<PatientFormData>,
): Promise<Patient> {
  const { data } = await api.put(`/patients/${id}`, payload)
  return data.data
}

/** Permanent delete — removes the patient and all of their records. */
export async function deletePatient(id: string): Promise<void> {
  await api.delete(`/patients/${id}`)
}

export async function setPatientStatus(
  id: string,
  isActive: boolean,
): Promise<Patient> {
  const { data } = await api.patch(`/patients/${id}/status`, { isActive })
  return data.data
}

export async function checkPhoneUnique(
  phone: string,
  excludeId?: string,
): Promise<{ exists: boolean }> {
  const { data } = await api.get(
    `/patients/check-phone/${encodeURIComponent(phone)}`,
    {
      params: { excludeId },
    },
  )
  return data.data
}

// ─── Sub-Entities Getters ──────────────────────────────────────────

export async function fetchPatientVisits(
  patientId: string,
): Promise<PatientVisit[]> {
  const { data } = await api.get(`/patients/${patientId}/visits`)
  return data.data
}

export async function fetchPatientDentalInfo(
  patientId: string,
): Promise<PatientDentalInfo | null> {
  const { data } = await api.get(`/patients/${patientId}/dental-info`)
  return data.data
}

// ─── Encounters & Treatments ────────────────────────────────────────

export async function fetchPatientHistory(
  patientId: string,
): Promise<PatientHistory> {
  const { data } = await api.get(`/patients/${patientId}/history`)
  return data.data
}

export async function fetchEncounterDetail(
  encounterId: string,
): Promise<Encounter> {
  const { data } = await api.get(`/encounters/${encounterId}`)
  return data.data
}

export async function fetchPatientTreatments(
  patientId: string,
): Promise<Treatment[]> {
  const { data } = await api.get('/treatments', { params: { patientId } })
  return data.data
}

export async function createTreatment(
  payload: TreatmentFormData & { patientId: string },
): Promise<Treatment> {
  const { data } = await api.post('/treatments', payload)
  return data.data
}

export async function createEncounterTreatment(
  encounterId: string,
  payload: TreatmentFormData,
): Promise<Treatment> {
  const { data } = await api.post(
    `/encounters/${encounterId}/treatments`,
    payload,
  )
  return data.data
}

export async function fetchPatientTeethCharts(
  patientId: string,
): Promise<PatientTeethChart[]> {
  const { data } = await api.get(`/patients/${patientId}/teeth-charts`)
  return data.data
}

export async function fetchPatientVitals(
  patientId: string,
): Promise<PatientVitals[]> {
  const { data } = await api.get(`/patients/${patientId}/vitals`)
  return data.data
}

export async function fetchPatientTreatmentPlans(
  patientId: string,
): Promise<PatientTreatmentPlan[]> {
  const { data } = await api.get(`/patients/${patientId}/treatment-plans`)
  return data.data
}

export async function fetchPatientPrescriptions(
  patientId: string,
): Promise<PatientPrescription[]> {
  const { data } = await api.get(`/patients/${patientId}/prescriptions`)
  return data.data
}

export async function fetchPatientDocuments(
  patientId: string,
): Promise<PatientDocument[]> {
  const { data } = await api.get(`/patients/${patientId}/documents`)
  return data.data
}

export async function fetchPatientConsents(
  patientId: string,
): Promise<PatientConsent[]> {
  const { data } = await api.get(`/patients/${patientId}/consents`)
  return data.data
}

export async function fetchPatientCommunications(
  patientId: string,
): Promise<PatientCommunication[]> {
  const { data } = await api.get(`/patients/${patientId}/communications`)
  return data.data
}

export async function fetchPatientRecalls(
  patientId: string,
): Promise<PatientRecall[]> {
  const { data } = await api.get(`/patients/${patientId}/recalls`)
  return data.data
}

export async function fetchPatientReferrals(
  patientId: string,
): Promise<PatientReferral[]> {
  const { data } = await api.get(`/patients/${patientId}/referrals`)
  return data.data
}

export async function fetchPatientFeedback(
  patientId: string,
): Promise<PatientFeedback[]> {
  const { data } = await api.get(`/patients/${patientId}/feedback`)
  return data.data
}

export async function fetchPatientInsurance(
  patientId: string,
): Promise<PatientInsurance[]> {
  const { data } = await api.get(`/patients/${patientId}/insurance`)
  return data.data
}

// ─── Sub-Entities Actions (Upsert / Create / Update) ─────────────────

export async function upsertPatientDentalInfo(
  patientId: string,
  payload: any,
): Promise<PatientDentalInfo> {
  const { data } = await api.post(`/patients/${patientId}/dental-info`, payload)
  return data.data
}

export async function createPatientTeethChart(
  patientId: string,
  payload: any,
): Promise<PatientTeethChart> {
  const { data } = await api.post(
    `/patients/${patientId}/teeth-charts`,
    payload,
  )
  return data.data
}

export async function createPatientVitals(
  patientId: string,
  payload: any,
): Promise<PatientVitals> {
  const { data } = await api.post(`/patients/${patientId}/vitals`, payload)
  return data.data
}

export async function createPatientTreatmentPlan(
  patientId: string,
  payload: any,
): Promise<PatientTreatmentPlan> {
  const { data } = await api.post(
    `/patients/${patientId}/treatment-plans`,
    payload,
  )
  return data.data
}

export async function updatePatientTreatmentPlan(
  patientId: string,
  planId: string,
  payload: any,
): Promise<PatientTreatmentPlan> {
  const { data } = await api.patch(
    `/patients/${patientId}/treatment-plans/${planId}`,
    payload,
  )
  return data.data
}

export async function createPatientTreatmentPlanItem(
  patientId: string,
  planId: string,
  payload: any,
): Promise<TreatmentPlanItem> {
  const { data } = await api.post(
    `/patients/${patientId}/treatment-plans/${planId}/items`,
    payload,
  )
  return data.data
}

export async function updatePatientTreatmentPlanItem(
  patientId: string,
  planId: string,
  itemId: string,
  payload: any,
): Promise<TreatmentPlanItem> {
  const { data } = await api.patch(
    `/patients/${patientId}/treatment-plans/${planId}/items/${itemId}`,
    payload,
  )
  return data.data
}

export async function createPatientPrescription(
  patientId: string,
  payload: any,
): Promise<PatientPrescription> {
  const { data } = await api.post(
    `/patients/${patientId}/prescriptions`,
    payload,
  )
  return data.data
}

export async function createPatientDocument(
  patientId: string,
  payload: any,
): Promise<PatientDocument> {
  const { data } = await api.post(`/patients/${patientId}/documents`, payload)
  return data.data
}

export async function createPatientConsent(
  patientId: string,
  payload: any,
): Promise<PatientConsent> {
  const { data } = await api.post(`/patients/${patientId}/consents`, payload)
  return data.data
}

export async function createPatientRecall(
  patientId: string,
  payload: any,
): Promise<PatientRecall> {
  const { data } = await api.post(`/patients/${patientId}/recalls`, payload)
  return data.data
}

export async function updatePatientRecall(
  patientId: string,
  recallId: string,
  payload: any,
): Promise<PatientRecall> {
  const { data } = await api.patch(
    `/patients/${patientId}/recalls/${recallId}`,
    payload,
  )
  return data.data
}

export async function createPatientInsurance(
  patientId: string,
  payload: any,
): Promise<PatientInsurance> {
  const { data } = await api.post(`/patients/${patientId}/insurance`, payload)
  return data.data
}

export async function createPatientCommunication(
  patientId: string,
  payload: any,
): Promise<PatientCommunication> {
  const { data } = await api.post(
    `/patients/${patientId}/communications`,
    payload,
  )
  return data.data
}
