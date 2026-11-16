import { toast } from 'sonner-native';

import {
  callNext,
  closeSession,
  openSession,
  pauseSession,
  resumeSession,
  setSessionMode,
  startSession,
} from '../api/queue.api';
import type { CloseSessionInput } from '../types/queue.types';
import { usePlainQueueMutation, useQueueMutation } from './queue-mutation';
import { trackStaff } from '@/staff/lib/analytics';

/** Doctor session actions (docs/07 §2.3). One `Idempotency-Key` per tap. */

export const useStartSession = () =>
  useQueueMutation((vars: { sessionId: string }, ctx) => startSession(vars, ctx));

export const usePauseSession = () =>
  useQueueMutation((vars: { sessionId: string; reason: string }, ctx) => pauseSession(vars, ctx));

export const useResumeSession = () =>
  useQueueMutation((vars: { sessionId: string }, ctx) => resumeSession(vars, ctx));

export const useCloseSession = () =>
  useQueueMutation((vars: { sessionId: string } & CloseSessionInput, ctx) =>
    closeSession(vars, ctx),
  );

export const useSetSessionMode = () =>
  useQueueMutation((vars: { sessionId: string; smartQueueEnabled: boolean }, ctx) =>
    setSessionMode(vars, ctx),
  );

/** An empty queue is a normal outcome, not an error. */
export const useCallNext = () =>
  useQueueMutation(
    (vars: { sessionId: string }, ctx) => callNext(vars, ctx),
    (result) => {
      if (result.reason === 'NO_ELIGIBLE_PATIENT') toast('No one is waiting');
      else trackStaff('staff_called_next');
    },
  );

/** Reception: open a doctor's lane. A get-or-create, not Idem: a plain mutation. */
export const useOpenSession = () => usePlainQueueMutation(openSession);
