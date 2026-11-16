import { useCallback } from 'react';

import { useDoseQueueStore, flushDoseQueue } from '../lib/dose-queue';
import type { DoseAction } from '../types/medications.types';

/**
 * Record a dose decision: written to the local queue first (instant, works offline), then a flush is
 * attempted — it simply keeps the event queued while the phone has no connection.
 */
export function useDoseActions() {
  const enqueue = useDoseQueueStore((s) => s.enqueue);
  return useCallback(
    (scheduleId: string, dueAt: string, action: DoseAction) => {
      enqueue({ scheduleId, dueAt, action, actedAt: new Date().toISOString() });
      void flushDoseQueue();
    },
    [enqueue],
  );
}
