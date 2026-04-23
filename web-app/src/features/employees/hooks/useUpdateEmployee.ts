import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateEmployee } from '../services/employees.api'
import { EMPLOYEES_QUERY_KEY } from './useEmployees'
import { EMPLOYEE_QUERY_KEY } from './useEmployee'
import type { EmployeeFormData } from '../types'

export function useUpdateEmployee(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<EmployeeFormData>) => updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEES_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_QUERY_KEY, id] })
    },
  })
}
