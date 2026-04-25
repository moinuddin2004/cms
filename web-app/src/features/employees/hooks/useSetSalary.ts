import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateSalary } from '../services/employees.api'
import { EMPLOYEE_QUERY_KEY } from './useEmployee'
import type { SalaryFormData } from '../types'

export function useUpdateSalary(employeeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SalaryFormData) => updateSalary(employeeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [EMPLOYEE_QUERY_KEY, employeeId],
      })
    },
  })
}
