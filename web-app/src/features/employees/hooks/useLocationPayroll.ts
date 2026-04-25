import { useQuery } from '@tanstack/react-query'
import { fetchLocationPayroll } from '../services/payroll.api'
import { useAuthStore } from '@/store/useAuthStore'

export const LOCATION_PAYROLL_KEY = 'location-payroll'

export function useLocationPayroll(month: number, year: number) {
  const { activeLocationId } = useAuthStore()

  return useQuery({
    queryKey: [LOCATION_PAYROLL_KEY, activeLocationId, month, year],
    queryFn: () => fetchLocationPayroll(month, year),
    enabled: !!activeLocationId && !!month && !!year,
  })
}
