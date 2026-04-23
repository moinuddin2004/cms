import { useQuery } from '@tanstack/react-query'
import { fetchAppointments } from '../services/dashboard.api'
import type { Appointment } from '../types'

export const APPOINTMENTS_KEY = ['dashboard', 'appointments'] as const

export function useDashboardAppointments() {
  return useQuery<Appointment[]>({
    queryKey: APPOINTMENTS_KEY,
    queryFn: fetchAppointments,
    staleTime: 5 * 60 * 1000,
  })
}
