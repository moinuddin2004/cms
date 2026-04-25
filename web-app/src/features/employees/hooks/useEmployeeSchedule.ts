import { useQuery } from '@tanstack/react-query'
import { fetchSchedule } from '../services/schedule.api'
import { useAuthStore } from '@/store/useAuthStore'

export const SCHEDULE_QUERY_KEY = 'schedule'

export function useEmployeeSchedule(employeeId: string) {
  const { activeLocationId } = useAuthStore()

  return useQuery({
    queryKey: [SCHEDULE_QUERY_KEY, employeeId, activeLocationId],
    queryFn: () => fetchSchedule(employeeId),
    enabled: !!employeeId && !!activeLocationId,
    staleTime: 5 * 60 * 1000,
  })
}
