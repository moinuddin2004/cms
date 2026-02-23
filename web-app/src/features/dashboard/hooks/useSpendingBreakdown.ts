import { useQuery } from '@tanstack/react-query';
import { fetchSpendingBreakdown } from '../services/dashboard.api';
import type { SpendingData } from '../types';

export const SPENDING_BREAKDOWN_KEY = ['dashboard', 'spending'] as const;

export function useSpendingBreakdown() {
    return useQuery<SpendingData>({
        queryKey: SPENDING_BREAKDOWN_KEY,
        queryFn: fetchSpendingBreakdown,
        staleTime: 5 * 60 * 1000,
    });
}
