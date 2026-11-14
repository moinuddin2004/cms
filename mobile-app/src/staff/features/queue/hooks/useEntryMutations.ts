import {
  abortEntry,
  cancelEntry,
  completeEntry,
  recallEntry,
  rejoinEntry,
  returnFromTest,
  selectEntry,
  sendForTest,
  setPriority,
  skipEntry,
  startConsultation,
  transferEntry,
  undoCall,
} from '../api/queue.api';
import { useQueueMutation, type EntryVars } from './queue-mutation';

/**
 * Entry actions. Variables carry `version` (the `entry.version` on screen):
 * it is sent as `If-Match`. Recall is the one entry action the server does
 * not version-check, so it takes no `version`.
 */

// ─── Doctor ──────────────────────────────────────────────────────

export const useSelectEntry = () =>
  useQueueMutation((vars: EntryVars<{ reason?: string }>, ctx) =>
    selectEntry(vars, { ...ctx, ifMatch: vars.version }),
  );

export const useRecallEntry = () =>
  useQueueMutation((vars: { entryId: string }, ctx) => recallEntry(vars, ctx));

export const useUndoCall = () =>
  useQueueMutation((vars: EntryVars, ctx) => undoCall(vars, { ...ctx, ifMatch: vars.version }));

export const useSkipEntry = () =>
  useQueueMutation((vars: EntryVars, ctx) => skipEntry(vars, { ...ctx, ifMatch: vars.version }));

export const useStartConsultation = () =>
  useQueueMutation((vars: EntryVars, ctx) =>
    startConsultation(vars, { ...ctx, ifMatch: vars.version }),
  );

export const useSendForTest = () =>
  useQueueMutation((vars: EntryVars<{ reason?: string }>, ctx) =>
    sendForTest(vars, { ...ctx, ifMatch: vars.version }),
  );

export const useCompleteEntry = () =>
  useQueueMutation((vars: EntryVars, ctx) =>
    completeEntry(vars, { ...ctx, ifMatch: vars.version }),
  );

export const useAbortEntry = () =>
  useQueueMutation((vars: EntryVars<{ reason?: string }>, ctx) =>
    abortEntry(vars, { ...ctx, ifMatch: vars.version }),
  );

// ─── Reception ───────────────────────────────────────────────────

export const useCancelEntry = () =>
  useQueueMutation((vars: EntryVars<{ reason?: string }>, ctx) =>
    cancelEntry(vars, { ...ctx, ifMatch: vars.version }),
  );

export const useRejoinEntry = () =>
  useQueueMutation((vars: EntryVars<{ placeAfterEntryId?: string }>, ctx) =>
    rejoinEntry(vars, { ...ctx, ifMatch: vars.version }),
  );

export const useReturnFromTest = () =>
  useQueueMutation((vars: EntryVars, ctx) =>
    returnFromTest(vars, { ...ctx, ifMatch: vars.version }),
  );

export const useTransferEntry = () =>
  useQueueMutation((vars: EntryVars<{ toDoctorId: string; reason?: string }>, ctx) =>
    transferEntry(vars, { ...ctx, ifMatch: vars.version }),
  );

/** Mark urgent — the server requires the reason. */
export const useMarkUrgent = () =>
  useQueueMutation((vars: EntryVars<{ reason: string }>, ctx) =>
    setPriority(vars, { ...ctx, ifMatch: vars.version }),
  );
