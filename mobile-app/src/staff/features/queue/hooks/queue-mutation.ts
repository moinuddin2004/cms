import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';

import { useIdempotentMutation, type IdempotencyContext } from '@/core/http';

import { queueKeys } from '../api/queue.keys';
import { queueErrorMessage, shouldRefetch } from '../lib/queue-errors';

/** Variables of an entry action: the entry and the version the screen shows (`If-Match`). */
export type EntryVars<T extends object = object> = { entryId: string; version: number } & T;

/**
 * Shared by every queue mutation. Success invalidates the whole queue prefix
 * (sessions, board, my-session, previews, tickets and visits all depend on an
 * entry's state); an error toasts the mapped copy and, when the screen is out
 * of date (`shouldRefetch`), invalidates too.
 */
export function useQueueInvalidation() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queueKeys.all });
  const onError = (err: unknown) => {
    toast.error(queueErrorMessage(err));
    if (shouldRefetch(err)) void invalidate();
  };
  return { invalidate, onError };
}

/** An Idem mutation (one `Idempotency-Key` per tap, reused on retries) with the shared handlers. */
export function useQueueMutation<TVars, TData>(
  mutationFn: (vars: TVars, ctx: IdempotencyContext) => Promise<TData>,
  onResult?: (data: TData) => void,
) {
  const { invalidate, onError } = useQueueInvalidation();
  return useIdempotentMutation<TVars, TData>({
    mutationFn,
    onSuccess: (data) => {
      onResult?.(data);
      return invalidate();
    },
    onError,
  });
}

/** For the one mutation whose endpoint is not Idem (`openSession`): no key reuse, no retry. */
export function usePlainQueueMutation<TVars, TData>(mutationFn: (vars: TVars) => Promise<TData>) {
  const { invalidate, onError } = useQueueInvalidation();
  return useMutation<TData, unknown, TVars>({
    mutationFn,
    retry: false,
    onSuccess: () => invalidate(),
    onError,
  });
}
