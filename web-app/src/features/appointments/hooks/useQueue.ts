import { useQuery } from '@tanstack/react-query'
import { fetchQueue } from '../services/appointments.api'

export const QUEUE_QUERY_KEY = 'appointment-queue'

/**
 * Today's queue for the active location. Polls every 8s and on window focus so
 * the reception desk and doctor stay in sync without a manual refresh.
 * `date` is the client's local YYYY-MM-DD.
 */
export function useQueue(date: string) {
  return useQuery({
    queryKey: [QUEUE_QUERY_KEY, date],
    queryFn: () => fetchQueue(date),
    refetchInterval: 8000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  })
}
