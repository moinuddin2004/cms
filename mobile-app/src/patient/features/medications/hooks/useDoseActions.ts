import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useDoseQueueStore, flushDoseQueue } from '../lib/dose-queue';
import type { DoseAction } from '../types/medications.types';

/**
 * Record a dose decision: written to the local queue first (instant, works offline), then a flush is
 * attempted — it simply keeps the event queued while the phone has no connection. `ready` is false
 * until the queue knows the account; screens keep their buttons disabled until then.
 */
export function useDoseActions() {
  const queryClient = useQueryClient();
  const enqueue = useDoseQueueStore((s) => s.enqueue);
  const ready = useDoseQueueStore((s) => s.accountId !== null);
  const record = useCallback(
    (scheduleId: string, dueAt: string, action: DoseAction) => {
      const saved = enqueue({ scheduleId, dueAt, action, actedAt: new Date().toISOString() });
      if (saved) void flushDoseQueue(queryClient);
      return saved;
    },
    [enqueue, queryClient],
  );
  return { record, ready };
}
