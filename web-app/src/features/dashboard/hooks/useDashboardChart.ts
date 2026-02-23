import { useQuery } from '@tanstack/react-query';
import { fetchChartData } from '../services/dashboard.api';
import type { ChartDataPoint } from '../types';

export const DASHBOARD_CHART_KEY = ['dashboard', 'chart'] as const;

export function useDashboardChart() {
    return useQuery<ChartDataPoint[]>({
        queryKey: DASHBOARD_CHART_KEY,
        queryFn: fetchChartData,
        staleTime: 5 * 60 * 1000,
    });
}
