import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { setEmployeeStatus } from '../services/employees.api'
import { EMPLOYEES_QUERY_KEY } from './useEmployees'

export function useSetEmployeeStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setEmployeeStatus(id, isActive),
    onSuccess: (_data, { isActive }) => {
      toast.success(isActive ? 'Employee activated' : 'Employee deactivated')
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_QUERY_KEY] })
    },
    onError: () => toast.error('Could not update employee status'),
  })
}
