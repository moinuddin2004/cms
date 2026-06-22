import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { updatePayroll } from '../services/payroll.api'
import { LOCATION_PAYROLL_KEY } from './useLocationPayroll'
import { PAYROLL_KEY } from './useEmployeePayroll'
import type { PayrollFormData } from '../types'

export function useUpdatePayroll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      recordId,
      data,
    }: {
      recordId: string
      data: Partial<Omit<PayrollFormData, 'employeeId'>>
    }) => updatePayroll(recordId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOCATION_PAYROLL_KEY] })
      queryClient.invalidateQueries({ queryKey: [PAYROLL_KEY] })
      toast.success('Payroll record updated')
    },
    onError: (err: any) =>
      toast.error(
        err?.response?.data?.message || 'Failed to update payroll record',
      ),
  })
}
