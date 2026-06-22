import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'
import * as api from '../services/billing.api'

export function useDailySummary(date: string) {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: ['financial-daily', activeLocationId, date],
    queryFn: () => api.fetchDailyFinancialSummary(date),
    enabled: !!activeLocationId && !!date,
  })
}

export function useMonthlySummary(month: number, year: number) {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: ['financial-monthly', activeLocationId, month, year],
    queryFn: () => api.fetchMonthlyFinancialSummary(month, year),
    enabled: !!activeLocationId,
  })
}

export function useRevenueTrend(months: number) {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: ['financial-trend', activeLocationId, months],
    queryFn: () => api.fetchRevenueTrend(months),
    enabled: !!activeLocationId,
  })
}
