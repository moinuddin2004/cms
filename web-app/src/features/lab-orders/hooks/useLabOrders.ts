import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastOrderError } from '../lib/order-errors'
import { labOrderKeys } from '../query-keys'
import { labOrdersApi } from '../services/lab-orders.api'
import type { LabOrderParams } from '../types'

export function useLabOrders(params: LabOrderParams) {
  return useQuery({
    queryKey: labOrderKeys.list(params),
    queryFn: () => labOrdersApi.list(params),
    placeholderData: keepPreviousData,
  })
}

export function useLabOrder(id: string | null) {
  return useQuery({
    queryKey: labOrderKeys.detail(id ?? ''),
    queryFn: () => labOrdersApi.get(id as string),
    enabled: !!id,
  })
}

/**
 * An order mutation that refreshes every order query when it settles and
 * toasts the outcome. `silentError` lets a form show issues inline instead.
 */
export function useOrderMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: {
    success?: string | ((result: TResult) => string)
    silentError?: boolean
  } = {},
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      const message =
        typeof opts.success === 'function' ? opts.success(result) : opts.success
      if (message) toast.success(message)
    },
    onError: opts.silentError ? undefined : toastOrderError,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: labOrderKeys.all }),
  })
}
