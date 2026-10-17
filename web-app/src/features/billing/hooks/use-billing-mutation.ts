import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { invalidateBilling, toastBillingError } from '../lib/billing-errors'

/**
 * Money mutation: no optimistic update, wait for the server, then
 * invalidate every billing view (plan §8.4). Errors become friendly toasts.
 */
export function useBillingMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: {
    success?: string | ((r: TResult) => string)
    silentError?: boolean
  } = {},
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await invalidateBilling(queryClient)
      const msg =
        typeof opts.success === 'function' ? opts.success(result) : opts.success
      if (msg) toast.success(msg)
    },
    onError: (err) => {
      if (!opts.silentError) toastBillingError(err)
    },
  })
}
