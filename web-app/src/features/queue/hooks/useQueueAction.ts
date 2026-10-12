import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { APPOINTMENTS_QUERY_KEY } from '@/features/appointments'
import { queueError } from '../utils/queueError'
import { QUEUE_KEY } from './useQueueData'

/**
 * Wraps a queue API call: refreshes queue + appointment data afterwards and
 * turns API error codes into readable toasts. A VERSION_CONFLICT means the
 * screen was stale — we refetch and say so rather than show a scary error.
 */
export function useQueueAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  opts: {
    success?: (result: TResult, args: TArgs) => string | null | undefined
    /** Return true to suppress the default error toast (caller handled it). */
    onError?: (
      err: ReturnType<typeof queueError>,
      args: TArgs,
    ) => boolean | void
  } = {},
) {
  const queryClient = useQueryClient()
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [QUEUE_KEY] })
    queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_QUERY_KEY] })
    queryClient.invalidateQueries({ queryKey: ['appointment-stats'] })
    queryClient.invalidateQueries({ queryKey: ['appointment-detail'] })
  }
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, args) => {
      refresh()
      const message = opts.success?.(result, args)
      if (message) toast.success(message)
    },
    onError: (err, args) => {
      const parsed = queueError(err)
      if (opts.onError?.(parsed, args)) return
      if (parsed.code === 'VERSION_CONFLICT') {
        toast.warning(
          'Someone else just changed this patient — showing the latest.',
        )
      } else {
        toast.error(parsed.message)
      }
      refresh()
    },
  })
}
