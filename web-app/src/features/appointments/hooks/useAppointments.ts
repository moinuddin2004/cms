import { useQuery } from '@tanstack/react-query'
import { fetchAppointments } from '../services/appointments.api'
import type { AppointmentListParams } from '../types'

export const APPOINTMENTS_QUERY_KEY = 'appointments'

export function useAppointments(params: AppointmentListParams, enabled = true) {
  return useQuery({
    enabled,
    queryKey: [APPOINTMENTS_QUERY_KEY, params],
    queryFn: () => fetchAppointments(params),
    placeholderData: (prev) => prev,
  })
}
