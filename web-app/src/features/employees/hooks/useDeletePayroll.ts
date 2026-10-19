import { useMutation, useQueryClient } from '@tanstack/react-query'
import { billingKeys } from '@/features/billing'
import { toast } from 'sonner'
import { deletePayroll } from '../services/payroll.api'
import { LOCATION_PAYROLL_KEY } from './useLocationPayroll'
import { PAYROLL_KEY } from './useEmployeePayroll'

export function useDeletePayroll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (recordId: string) => deletePayroll(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOCATION_PAYROLL_KEY] })
      queryClient.invalidateQueries({ queryKey: [PAYROLL_KEY] })
      // Payroll settles commission: refresh earnings / doctor reports.
      queryClient.invalidateQueries({ queryKey: billingKeys.commissions.all })
      toast.success('Payroll record deleted')
    },
    onError: (err: any) =>
      toast.error(
        err?.response?.data?.message || 'Failed to delete payroll record',
      ),
  })
}
