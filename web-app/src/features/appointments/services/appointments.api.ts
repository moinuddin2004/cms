import api from '@/lib/api'
import type {
  Appointment,
  AppointmentFormData,
  AppointmentListParams,
  AppointmentStats,
  CancelReason,
  Doctor,
  PaginatedAppointments,
  ValidateAppointmentData,
  ValidationResult,
  WalkInFormData,
} from '../types'

// ─── Appointments CRUD ──────────────────────────────────────────────

export async function fetchAppointments(
  params: AppointmentListParams,
): Promise<PaginatedAppointments> {
  const { data } = await api.get('/appointments', { params })
  return data.data
}

export async function fetchAppointmentById(id: string): Promise<Appointment> {
  const { data } = await api.get(`/appointments/${id}`)
  return data.data
}

export async function createAppointment(
  payload: AppointmentFormData,
): Promise<Appointment> {
  const { data } = await api.post('/appointments', payload)
  return data.data
}

export async function updateAppointment(
  id: string,
  payload: Partial<AppointmentFormData>,
): Promise<Appointment> {
  const { data } = await api.put(`/appointments/${id}`, payload)
  return data.data
}

export async function createWalkIn(
  payload: WalkInFormData,
): Promise<Appointment> {
  const { data } = await api.post('/appointments/walk-in', payload)
  return data.data
}

// ─── Today's Queue ──────────────────────────────────────────────────

/** `date` is the client's local YYYY-MM-DD (defaults server-side to today). */
export async function fetchQueue(date?: string): Promise<Appointment[]> {
  const { data } = await api.get('/appointments/queue', { params: { date } })
  return data.data
}

// ─── Validation ─────────────────────────────────────────────────────

export async function validateAppointment(
  payload: ValidateAppointmentData,
): Promise<ValidationResult> {
  const { data } = await api.post('/appointments/validate', payload)
  return data.data
}

// ─── Status Transitions ─────────────────────────────────────────────

export async function cancelAppointment(
  id: string,
  payload?: { reasonCode?: CancelReason; reason?: string },
): Promise<Appointment> {
  const { data } = await api.patch(`/appointments/${id}/cancel`, payload ?? {})
  return data.data
}

export async function markNoShow(id: string): Promise<Appointment> {
  const { data } = await api.patch(`/appointments/${id}/no-show`)
  return data.data
}

export async function checkInAppointment(id: string): Promise<Appointment> {
  const { data } = await api.patch(`/appointments/${id}/check-in`)
  return data.data
}

export async function startAppointment(id: string): Promise<Appointment> {
  const { data } = await api.patch(`/appointments/${id}/start`)
  return data.data
}

export async function completeAppointment(id: string): Promise<Appointment> {
  const { data } = await api.patch(`/appointments/${id}/complete`)
  return data.data
}

export async function confirmAppointment(id: string): Promise<Appointment> {
  const { data } = await api.patch(`/appointments/${id}/confirm`)
  return data.data
}

// ─── Doctors & Stats ────────────────────────────────────────────────

export async function fetchDoctors(): Promise<Doctor[]> {
  const { data } = await api.get('/appointments/doctors')
  return data.data
}

export async function fetchAppointmentStats(
  startDate?: string,
  endDate?: string,
): Promise<AppointmentStats> {
  const { data } = await api.get('/appointments/stats', {
    params: { startDate, endDate },
  })
  return data.data
}

// ─── Availability ───────────────────────────────────────────────────

export interface AvailabilityBlock {
  doctorId: string
  doctorName: string
  start: string
  end: string
  dayOfWeek: number
  slotDuration: number
}

export async function fetchAvailability(
  startDate: string,
  endDate: string,
  doctorId?: string,
): Promise<AvailabilityBlock[]> {
  const { data } = await api.get('/appointments/availability', {
    params: { startDate, endDate, doctorId },
  })
  return data.data
}
