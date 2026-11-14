import {
  useCancelEntry,
  useMarkUrgent,
  useRejoinEntry,
  useReturnFromTest,
  useSkipEntry,
  useTransferEntry,
} from '../../hooks/useEntryMutations';
import type { EntryView } from '../../types/queue.types';

/**
 * The reception board's entry mutations behind one object. Every call sends
 * the `entry.version` on screen as `If-Match`; the hooks toast errors. The
 * promises reject on failure so a dialog can stay open (it already toasted).
 * `pendingEntryId` is the row being changed — that row is disabled meanwhile.
 */
export function useBoardActions() {
  const skip = useSkipEntry();
  const rejoin = useRejoinEntry();
  const backFromTest = useReturnFromTest();
  const cancel = useCancelEntry();
  const transfer = useTransferEntry();
  const urgent = useMarkUrgent();

  const pending = [skip, rejoin, backFromTest, cancel, transfer, urgent].find((m) => m.isPending);
  const pendingEntryId = pending?.variables?.entryId ?? null;

  return {
    pendingEntryId,
    skip: (e: EntryView) => skip.mutateAsync({ entryId: e.id, version: e.version }),
    rejoin: (e: EntryView) => rejoin.mutateAsync({ entryId: e.id, version: e.version }),
    backFromTest: (e: EntryView) => backFromTest.mutateAsync({ entryId: e.id, version: e.version }),
    cancel: (e: EntryView) => cancel.mutateAsync({ entryId: e.id, version: e.version }),
    transfer: (e: EntryView, toDoctorId: string) =>
      transfer.mutateAsync({ entryId: e.id, version: e.version, toDoctorId }),
    markUrgent: (e: EntryView, reason: string) =>
      urgent.mutateAsync({ entryId: e.id, version: e.version, reason }),
  };
}

export type BoardActions = ReturnType<typeof useBoardActions>;
