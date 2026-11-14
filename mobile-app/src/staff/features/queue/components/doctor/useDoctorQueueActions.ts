import { AccessibilityInfo } from 'react-native';

import {
  useAbortEntry,
  useCompleteEntry,
  useRecallEntry,
  useSelectEntry,
  useSendForTest,
  useSkipEntry,
  useStartConsultation,
  useUndoCall,
} from '../../hooks/useEntryMutations';
import {
  useCallNext,
  usePauseSession,
  useResumeSession,
  useSetSessionMode,
  useStartSession,
} from '../../hooks/useSessionMutations';
import { shouldRefetch } from '../../lib/queue-errors';
import type { EntryView } from '../../types/queue.types';
import { hapticSuccess, hapticWarning } from './haptics';

/** The entry a pending mutation runs on, if any. */
function pendingEntryId(m: { isPending: boolean; variables?: { entryId: string } }) {
  return m.isPending && m.variables ? m.variables.entryId : null;
}

/**
 * Every doctor-screen action in one place. Entry actions take the entry as
 * shown (its `version` goes out as `If-Match`). `busyEntryIds` lists the
 * entries with a pending mutation so a row is locked while any action on it
 * runs; `sessionBusy` does the same for session-level actions.
 *
 * The ReasonSheet actions resolve `true` when the sheet may close: success, or
 * an out-of-date entry (the screen refetches). A plain failure keeps it open.
 */
export function useDoctorQueueActions() {
  const start = useStartSession();
  const pause = usePauseSession();
  const resume = useResumeSession();
  const mode = useSetSessionMode();
  const callNext = useCallNext();
  const select = useSelectEntry();
  const recall = useRecallEntry();
  const undo = useUndoCall();
  const skip = useSkipEntry();
  const startConsult = useStartConsultation();
  const sendForTest = useSendForTest();
  const complete = useCompleteEntry();
  const abort = useAbortEntry();

  const busyEntryIds = new Set(
    [select, recall, undo, skip, startConsult, sendForTest, complete, abort]
      .map(pendingEntryId)
      .filter((id): id is string => id !== null),
  );
  const sessionBusy =
    start.isPending || pause.isPending || resume.isPending || mode.isPending || callNext.isPending;

  /** Run a mutation; resolves true when the caller may close its sheet. */
  async function settle(run: () => Promise<unknown>): Promise<boolean> {
    try {
      await run();
      hapticSuccess();
      return true;
    } catch (err) {
      hapticWarning();
      return shouldRefetch(err);
    }
  }
  const fire = (run: () => Promise<unknown>) => void settle(run);

  return {
    busyEntryIds,
    sessionBusy,
    startSession: (sessionId: string) => fire(() => start.mutateAsync({ sessionId })),
    resumeSession: (sessionId: string) => fire(() => resume.mutateAsync({ sessionId })),
    pauseSession: (sessionId: string, reason: string | undefined) =>
      settle(() => pause.mutateAsync({ sessionId, reason: reason ?? '' })),
    setSmartOrder: (sessionId: string, smartQueueEnabled: boolean) =>
      fire(() => mode.mutateAsync({ sessionId, smartQueueEnabled })),
    callNext: async (sessionId: string) => {
      try {
        const result = await callNext.mutateAsync({ sessionId });
        if (result.entry) {
          hapticSuccess();
          const who = result.entry.patient?.fullName;
          AccessibilityInfo.announceForAccessibility(
            who ? `Called ${result.entry.token}, ${who}` : `Called ${result.entry.token}`,
          );
        }
      } catch {
        hapticWarning();
      }
    },
    startConsultation: (e: EntryView) =>
      fire(() => startConsult.mutateAsync({ entryId: e.id, version: e.version })),
    complete: (e: EntryView) =>
      fire(() => complete.mutateAsync({ entryId: e.id, version: e.version })),
    recall: (e: EntryView) => fire(() => recall.mutateAsync({ entryId: e.id })),
    undoCall: (e: EntryView) => fire(() => undo.mutateAsync({ entryId: e.id, version: e.version })),
    skip: (e: EntryView) => fire(() => skip.mutateAsync({ entryId: e.id, version: e.version })),
    sendForTest: (e: EntryView, reason: string | undefined) =>
      settle(() => sendForTest.mutateAsync({ entryId: e.id, version: e.version, reason })),
    abort: (e: EntryView, reason: string | undefined) =>
      settle(() => abort.mutateAsync({ entryId: e.id, version: e.version, reason })),
    select: (e: EntryView, reason: string | undefined) =>
      settle(() => select.mutateAsync({ entryId: e.id, version: e.version, reason })),
  };
}

export type DoctorQueueActions = ReturnType<typeof useDoctorQueueActions>;
