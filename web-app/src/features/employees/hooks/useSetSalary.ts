import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setSalary } from '../services/employees.api'
import { EMPLOYEE_QUERY_KEY } from './useEmployee'
import type { SalaryFormData } from '../types'

export function useSetSalary(employeeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SalaryFormData) => setSalary(employeeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMPLOYEE_QUERY_KEY, employeeId] })
    },
  })
}
