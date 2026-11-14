import { useQuery } from '@tanstack/react-query';

import { useRoomSubscription } from '@/staff/lib/realtime-provider';

import { fetchSession } from '../api/queue.api';
import { queueKeys } from '../api/queue.keys';
import { sessionRoom, useQueuePollInterval } from './queue-rooms';

/** One doctor's queue by session id (reception view). Live while mounted. */
export function useSession(sessionId: string | undefined) {
  const refetchInterval = useQueuePollInterval();
  const query = useQuery({
    queryKey: queueKeys.session(sessionId ?? ''),
    queryFn: () => fetchSession(sessionId ?? ''),
    enabled: !!sessionId,
    staleTime: 0,
    refetchInterval,
  });
  useRoomSubscription(sessionId ? sessionRoom(sessionId) : null);
  return query;
}
