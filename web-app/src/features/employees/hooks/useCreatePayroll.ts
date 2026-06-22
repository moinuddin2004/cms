import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createPayroll } from '../services/payroll.api'
import { LOCATION_PAYROLL_KEY } from './useLocationPayroll'
import { PAYROLL_KEY } from './useEmployeePayroll'
import type { PayrollFormData } from '../types'

export function useCreatePayroll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: PayrollFormData) => createPayroll(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOCATION_PAYROLL_KEY] })
      queryClient.invalidateQueries({ queryKey: [PAYROLL_KEY] })
      toast.success('Payroll record created')
    },
    onError: (err: any) =>
      toast.error(
        err?.response?.data?.message || 'Failed to create payroll record',
      ),
  })
}
