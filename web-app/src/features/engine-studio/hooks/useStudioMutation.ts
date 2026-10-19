import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastStudioError } from '../lib/studio-errors'
import { studioKeys } from '../query-keys'

/**
 * A Studio mutation that refreshes every Studio query when it settles — also
 * after a STALE_VERSION conflict, so the editor reloads the latest data —
 * and toasts the outcome.
 */
export function useStudioMutation<TVars, TResult>(
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
    onError: toastStudioError,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: studioKeys.all }),
  })
}
