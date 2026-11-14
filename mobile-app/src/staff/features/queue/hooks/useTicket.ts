import { useQuery } from '@tanstack/react-query';

import { fetchTicket } from '../api/queue.api';
import { queueKeys } from '../api/queue.keys';

/** A patient's queue ticket. It has no room of its own: the session room's events invalidate it. */
export function useTicket(entryId: string | undefined) {
  return useQuery({
    queryKey: queueKeys.ticket(entryId ?? ''),
    queryFn: () => fetchTicket(entryId ?? ''),
    enabled: !!entryId,
    staleTime: 0,
  });
}
