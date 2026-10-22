import { useQuery } from '@tanstack/react-query'
import { fetchAppointmentStats } from '../services/appointments.api'

export function useAppointmentStats(
  startDate?: string,
  endDate?: string,
  enabled = true,
) {
  return useQuery({
    enabled,
    queryKey: ['appointment-stats', startDate, endDate],
    queryFn: () => fetchAppointmentStats(startDate, endDate),
  })
}
