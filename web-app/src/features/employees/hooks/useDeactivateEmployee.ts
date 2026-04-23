import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deactivateEmployee } from '../services/employees.api'
import { EMPLOYEES_QUERY_KEY } from './useEmployees'

export function useDeactivateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deactivateEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_QUERY_KEY] })
    },
  })
}
