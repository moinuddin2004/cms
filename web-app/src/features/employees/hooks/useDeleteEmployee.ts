import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deleteEmployee } from '../services/employees.api'
import { EMPLOYEES_QUERY_KEY } from './useEmployees'

export function useDeleteEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      toast.success('Employee deleted permanently')
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_QUERY_KEY] })
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message ?? 'Could not delete employee'),
  })
}
