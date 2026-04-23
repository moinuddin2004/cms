import { useMutation, useQueryClient } from '@tanstack/react-query'
import { generatePayroll } from '../services/payroll.api'
import { PAYROLL_KEY } from './useEmployeePayroll'

export function useGeneratePayroll() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: generatePayroll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYROLL_KEY] })
    },
  })
}
