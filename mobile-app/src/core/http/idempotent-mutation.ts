/**
 * `useIdempotentMutation` — a TanStack mutation that sends one idempotency key
 * per `mutate()` call (one user intent). The key is reused only for automatic
 * retries of that call; the next `mutate()` gets a new key (docs/04 §8).
 */
import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { MAX_RETRIES, isRetryable, newIdempotencyKey, retryDelayMs } from './idempotency';

export interface IdempotencyContext {
  idempotencyKey: string;
}

export interface UseIdempotentMutationOptions<TVars, TData> {
  mutationFn: (vars: TVars, ctx: IdempotencyContext) => Promise<TData>;
  onSuccess?: (data: TData, vars: TVars) => void | Promise<void>;
  onError?: (error: unknown, vars: TVars) => void | Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useIdempotentMutation<TVars = void, TData = unknown>(
  options: UseIdempotentMutationOptions<TVars, TData>,
): UseMutationResult<TData, unknown, TVars> {
  const { mutationFn, onSuccess, onError } = options;

  return useMutation<TData, unknown, TVars>({
    mutationFn: async (vars) => {
      const ctx: IdempotencyContext = { idempotencyKey: newIdempotencyKey() };
      for (let attempt = 0; ; attempt++) {
        try {
          return await mutationFn(vars, ctx);
        } catch (err) {
          if (!isRetryable(err) || attempt >= MAX_RETRIES) throw err;
          await sleep(retryDelayMs(attempt));
        }
      }
    },
    // We retry inside mutationFn so the key is shared; TanStack must not retry again.
    retry: false,
    onSuccess,
    onError,
  });
}
