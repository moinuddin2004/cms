import { ConnectionPill } from '@/core/components';
import type { ConnectionState } from '@/core/components';

import { useRealtimeStatus } from './realtime-provider';

const PILL_LABELS: Record<ConnectionState, string> = {
  live: 'Live',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
};

/** The core `ConnectionPill` fed by `useRealtimeStatus()`; place it on realtime screens (M1-08/09). */
export function RealtimeConnectionPill() {
  return <ConnectionPill state={useRealtimeStatus()} labels={PILL_LABELS} />;
}
