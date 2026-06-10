import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { togglePortalAccess } from '../services/employees.api'

export function useTogglePortalAccess() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      employeeId,
      hasPortalAccess,
    }: {
      employeeId: string
      hasPortalAccess: boolean
    }) => togglePortalAccess(employeeId, hasPortalAccess),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employee'] })
      toast.success(
        data.hasPortalAccess
          ? 'Portal access enabled'
          : 'Portal access disabled',
      )
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || 'Failed to update portal access',
      )
    },
  })
}
