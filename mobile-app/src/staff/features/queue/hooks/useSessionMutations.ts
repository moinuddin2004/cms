import { toast } from 'sonner-native';

import { newIdempotencyKey } from '@/core/http';

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
    },
  );

/**
 * Reception: open a doctor's lane. The endpoint is a get-or-create and ignores
 * the key, so this is a plain mutation (no retry, no key reuse); the api layer
 * still wants a key, so each call mints a throw-away one.
 */
export const useOpenSession = () =>
  usePlainQueueMutation((vars: { doctorId?: string }) =>
    openSession(vars, { idempotencyKey: newIdempotencyKey() }),
  );
