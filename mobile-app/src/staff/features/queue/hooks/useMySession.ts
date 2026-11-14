import { useQuery } from '@tanstack/react-query';

import { todayYmd } from '@/staff/lib/datetime';
import { useRoomSubscription } from '@/staff/lib/realtime-provider';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { fetchMySession } from '../api/queue.api';
import { queueKeys } from '../api/queue.keys';
import { sessionRoom, useQueuePollInterval } from './queue-rooms';

/**
 * The signed-in doctor's queue for today. Joins the session's room while
 * mounted (the id is known once the first fetch lands) and polls only when
 * realtime is not live.
 */
export function useMySession() {
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  const refetchInterval = useQueuePollInterval();
  const query = useQuery({
    queryKey: queueKeys.mySession(locationId ?? '', todayYmd()),
    queryFn: fetchMySession,
    enabled: !!locationId,
    staleTime: 0,
    refetchInterval,
  });
  useRoomSubscription(query.data ? sessionRoom(query.data.session.id) : null);
  return query;
}
