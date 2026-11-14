import { useRealtimeStatus } from '@/staff/lib/realtime-provider';

/** Poll fallback while the socket is not live (card M1-07). */
export const POLL_INTERVAL_MS = 10_000;

/** Room of one doctor's queue (backend `queue.gateway.ts`). */
export const sessionRoom = (sessionId: string) => `session:${sessionId}`;
/** Room of every queue at a location (reception board). */
export const boardRoom = (locationId: string) => `location:${locationId}:board`;

/**
 * `refetchInterval` for the live queue reads: `false` while realtime is live,
 * a 10 s poll otherwise. Realtime itself only invalidates queries.
 */
export function useQueuePollInterval(): number | false {
  return useRealtimeStatus() === 'live' ? false : POLL_INTERVAL_MS;
}
