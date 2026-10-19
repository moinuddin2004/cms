import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastLabError } from '../lib/lab-errors'
import { labKeys } from '../query-keys'

/**
 * A labs mutation that refreshes every labs query when it settles — also
 * after a STALE_VERSION conflict, so the form re-opens on the latest data —
 * and toasts the outcome.
 */
export function useLabMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { success?: string | ((result: TResult) => string) } = {},
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      const message =
        typeof opts.success === 'function' ? opts.success(result) : opts.success
      if (message) toast.success(message)
    },
    onError: toastLabError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: labKeys.all }),
  })
}
