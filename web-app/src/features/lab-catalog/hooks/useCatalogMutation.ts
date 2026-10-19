import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastCatalogError } from '../lib/catalog-errors'
import { catalogKeys } from '../query-keys'

/**
 * A catalog mutation that refreshes every catalog query when it settles —
 * also after a STALE_VERSION conflict, so a re-opened form has the latest
 * data — and toasts the outcome.
 */
export function useCatalogMutation<TVars, TResult>(
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
    onError: toastCatalogError,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}
