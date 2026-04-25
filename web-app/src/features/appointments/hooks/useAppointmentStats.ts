import { useQuery } from '@tanstack/react-query'
import { fetchAppointmentStats } from '../services/appointments.api'

export function useAppointmentStats(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['appointment-stats', startDate, endDate],
    queryFn: () => fetchAppointmentStats(startDate, endDate),
  })
}
