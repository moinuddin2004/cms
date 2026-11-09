import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { resetEmployeeGoogleLink } from '../services/employees.api'
import { EMPLOYEE_QUERY_KEY } from './useEmployee'

/** Let an employee link a different Google account on their next sign-in. */
export function useResetGoogleLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: resetEmployeeGoogleLink,
    onSuccess: (_data, employeeId) => {
      toast.success('Google sign-in reset', {
        description:
          'Their next Google sign-in links the Google account of their login email.',
      })
      void qc.invalidateQueries({ queryKey: [EMPLOYEE_QUERY_KEY, employeeId] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message
      toast.error(msg || 'Could not reset Google sign-in')
    },
  })
}
