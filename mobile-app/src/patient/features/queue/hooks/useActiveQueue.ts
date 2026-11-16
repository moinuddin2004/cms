import { useQuery } from '@tanstack/react-query';

import { useAccountId } from '@/patient/features/records/hooks/useAccountId';
import { useRealtimeLive, useWatchEntries } from '@/patient/lib/realtime-provider';

import { fetchActiveQueue } from '../api/queue.api';
import { queueKeys } from '../api/queue.keys';

/** While the socket is not live (disconnected, refused, no network push) the query polls this often. */
export const POLL_MS = 5_000;

/** With no active entry there is nothing to watch: a slow safety poll only (focus + feed.changed do the rest). */
export const IDLE_POLL_MS = 60_000;

/**
 * The patient's live queue entries. Realtime only invalidates this query; the socket is joined to
 * every entry returned, and while it is not live the query polls (and refetches on focus/reconnect).
 */
export function useActiveQueue() {
  const accountId = useAccountId();
  const live = useRealtimeLive();
  const query = useQuery({
    queryKey: queueKeys.active(accountId),
    queryFn: fetchActiveQueue,
    enabled: !!accountId,
    staleTime: 0,
    // Live entries poll fast only while the socket is down; an empty list barely polls at all.
    refetchInterval: (q) => (live ? false : q.state.data?.length ? POLL_MS : IDLE_POLL_MS),
    refetchOnReconnect: 'always',
  });
  useWatchEntries(query.data?.map((e) => e.entryId) ?? []);
  return { ...query, live };
}
