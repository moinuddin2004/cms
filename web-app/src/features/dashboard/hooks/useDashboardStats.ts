import { useQuery } from '@tanstack/react-query'
import { fetchDashboardStats } from '../services/dashboard.api'
import type { DashboardStats } from '../types'

export const DASHBOARD_STATS_KEY = ['dashboard', 'stats'] as const

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: DASHBOARD_STATS_KEY,
    queryFn: fetchDashboardStats,
    staleTime: 5 * 60 * 1000,
  })
}
