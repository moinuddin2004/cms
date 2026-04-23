import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createEmployee } from '../services/employees.api'
import { EMPLOYEES_QUERY_KEY } from './useEmployees'

export function useCreateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_QUERY_KEY] })
    },
  })
}
