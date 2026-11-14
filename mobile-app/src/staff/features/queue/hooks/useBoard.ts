import { useQuery } from '@tanstack/react-query';

import { useClinicToday } from '@/staff/lib/clinic-today';
import { useRoomSubscription } from '@/staff/lib/realtime-provider';
import { useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

import { fetchBoard } from '../api/queue.api';
import { queueKeys } from '../api/queue.keys';
import { boardRoom, useQueuePollInterval } from './queue-rooms';

/** Reception board (every doctor's lane) for today. Live while mounted. */
export function useBoard() {
  const locationId = useStaffAuthStore((s) => s.activeLocationId);
  const refetchInterval = useQueuePollInterval();
  const ymd = useClinicToday();
  const query = useQuery({
    queryKey: queueKeys.board(locationId ?? '', ymd),
    queryFn: () => fetchBoard(ymd),
    enabled: !!locationId,
    staleTime: 0,
    refetchInterval,
  });
  useRoomSubscription(locationId ? boardRoom(locationId) : null);
  return query;
}
