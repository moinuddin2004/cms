import api from '@/lib/api'
import type {
  CreatePrescriptionInput,
  DoctorSignature,
  FinalizePrescriptionInput,
  MedicineDirectoryItem,
  MedicineType,
  Prescription,
  PrescriptionFilterParams,
  PrescriptionHistoryEntry,
  PrescriptionListResponse,
  PrescriptionMedicine,
  PrescriptionTemplate,
  TreatmentPlanTemplate,
  UpdatePrescriptionInput,
} from '../types'

// ─── Medicine directory ───────────────────────────────────────────────

export async function fetchMedicines(): Promise<MedicineDirectoryItem[]> {
  const { data } = await api.get('/medicine-directory')
  return data.data
}

export async function searchMedicines(
  query: string,
  type?: MedicineType,
  limit = 10,
): Promise<MedicineDirectoryItem[]> {
  const { data } = await api.get('/medicine-directory/search', {
    params: { query, type, limit },
  })
  return data.data
}

export async function createMedicine(payload: Partial<MedicineDirectoryItem>) {
  const { data } = await api.post('/medicine-directory', payload)
  return data.data as MedicineDirectoryItem
}

export async function updateMedicine(
  id: string,
  payload: Partial<MedicineDirectoryItem>,
) {
  const { data } = await api.patch(`/medicine-directory/${id}`, payload)
  return data.data as MedicineDirectoryItem
}

export async function deactivateMedicine(id: string) {
  await api.delete(`/medicine-directory/${id}`)
}

export async function seedCommonMedicines() {
  const { data } = await api.post('/medicine-directory/seed-common')
  return data.data as { seeded: number; skipped: boolean }
}

// ─── Prescription templates (PDF layouts) ─────────────────────────────

export async function fetchPrescriptionTemplates(
  locationId?: string,
): Promise<PrescriptionTemplate[]> {
  const { data } = await api.get('/prescription-templates', {
    params: locationId ? { locationId } : undefined,
  })
  return data.data
}

export async function fetchDefaultPrescriptionTemplate(
  locationId?: string,
): Promise<PrescriptionTemplate | null> {
  const { data } = await api.get('/prescription-templates/default', {
    params: locationId ? { locationId } : undefined,
  })
  return data.data
}

export async function fetchPrescriptionTemplate(id: string) {
  const { data } = await api.get(`/prescription-templates/${id}`)
  return data.data as PrescriptionTemplate
}

export async function createPrescriptionTemplate(
  payload: Partial<PrescriptionTemplate>,
) {
  const { data } = await api.post('/prescription-templates', payload)
  return data.data as PrescriptionTemplate
}

export async function updatePrescriptionTemplate(
  id: string,
  payload: Partial<PrescriptionTemplate>,
) {
  const { data } = await api.patch(`/prescription-templates/${id}`, payload)
  return data.data as PrescriptionTemplate
}

export async function deactivatePrescriptionTemplate(id: string) {
  await api.delete(`/prescription-templates/${id}`)
}

// ─── Treatment plan templates ─────────────────────────────────────────

export async function fetchTreatmentPlanTemplates(
  category?: string,
): Promise<TreatmentPlanTemplate[]> {
  const { data } = await api.get('/treatment-plan-templates', {
    params: category ? { category } : undefined,
  })
  return data.data
}

export async function fetchTreatmentPlanTemplate(id: string) {
  const { data } = await api.get(`/treatment-plan-templates/${id}`)
  return data.data as TreatmentPlanTemplate
}

export async function createTreatmentPlanTemplate(
  payload: Partial<TreatmentPlanTemplate>,
) {
  const { data } = await api.post('/treatment-plan-templates', payload)
  return data.data as TreatmentPlanTemplate
}

export async function updateTreatmentPlanTemplate(
  id: string,
  payload: Partial<TreatmentPlanTemplate>,
) {
  const { data } = await api.patch(`/treatment-plan-templates/${id}`, payload)
  return data.data as TreatmentPlanTemplate
}

export async function deactivateTreatmentPlanTemplate(id: string) {
  await api.delete(`/treatment-plan-templates/${id}`)
}

// ─── Doctor signatures ────────────────────────────────────────────────

export async function fetchMySignature(): Promise<DoctorSignature | null> {
  const { data } = await api.get('/doctor-signatures/my')
  return data.data
}

export async function saveMySignature(payload: {
  signatureImageUrl: string
  signatureData?: string
}): Promise<DoctorSignature> {
  const { data } = await api.post('/doctor-signatures', payload)
  return data.data
}

export async function deleteMySignature() {
  await api.delete('/doctor-signatures')
}

// ─── Prescriptions ────────────────────────────────────────────────────

export async function fetchPrescriptions(
  params: PrescriptionFilterParams,
): Promise<PrescriptionListResponse> {
  const { data } = await api.get('/prescriptions', { params })
  return data.data
}

export async function fetchPrescription(id: string): Promise<Prescription> {
  const { data } = await api.get(`/prescriptions/${id}`)
  return data.data
}

export async function fetchPrescriptionsByPatient(
  patientId: string,
  page = 1,
  limit = 20,
): Promise<{ data: Prescription[]; total: number }> {
  const { data } = await api.get(`/prescriptions/patient/${patientId}`, {
    params: { page, limit },
  })
  return data.data
}

export async function fetchPrescriptionsByEncounter(
  encounterId: string,
): Promise<Prescription[]> {
  const { data } = await api.get(`/prescriptions/encounter/${encounterId}`)
  return data.data
}

export async function fetchPrescriptionsByAppointment(
  appointmentId: string,
): Promise<Prescription[]> {
  const { data } = await api.get(`/prescriptions/appointment/${appointmentId}`)
  return data.data
}

export async function fetchPrescriptionStats() {
  const { data } = await api.get('/prescriptions/stats')
  return data.data as {
    total: number
    thisMonth: number
    finalized: number
    draft: number
  }
}

export async function createPrescription(
  payload: CreatePrescriptionInput,
): Promise<Prescription> {
  const { data } = await api.post('/prescriptions', payload)
  return data.data
}

export async function updatePrescription(
  id: string,
  payload: UpdatePrescriptionInput,
): Promise<Prescription> {
  const { data } = await api.patch(`/prescriptions/${id}`, payload)
  return data.data
}

export async function addPrescriptionMedicine(
  id: string,
  payload: PrescriptionMedicine,
) {
  const { data } = await api.post(`/prescriptions/${id}/medicines`, payload)
  return data.data as PrescriptionMedicine
}

export async function updatePrescriptionMedicine(
  id: string,
  medicineId: string,
  payload: PrescriptionMedicine,
) {
  const { data } = await api.patch(
    `/prescriptions/${id}/medicines/${medicineId}`,
    payload,
  )
  return data.data as PrescriptionMedicine
}

export async function removePrescriptionMedicine(
  id: string,
  medicineId: string,
) {
  await api.delete(`/prescriptions/${id}/medicines/${medicineId}`)
}

export async function finalizePrescription(
  id: string,
  payload: FinalizePrescriptionInput,
): Promise<Prescription> {
  const { data } = await api.post(`/prescriptions/${id}/finalize`, payload)
  return data.data
}

export async function duplicatePrescription(id: string): Promise<Prescription> {
  const { data } = await api.post(`/prescriptions/${id}/duplicate`)
  return data.data
}

export async function fetchPrescriptionHistory(
  id: string,
): Promise<PrescriptionHistoryEntry[]> {
  const { data } = await api.get(`/prescriptions/${id}/history`)
  return data.data
}

/** Fetches the inline PDF stream as a Blob — caller decides print vs download. */
export async function fetchPrescriptionPdf(id: string): Promise<Blob> {
  const res = await api.get(`/prescriptions/${id}/pdf`, {
    responseType: 'blob',
  })
  return res.data
}
