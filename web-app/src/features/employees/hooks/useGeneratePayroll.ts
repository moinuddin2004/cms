import { useMutation, useQueryClient } from '@tanstack/react-query'
import { billingKeys } from '@/features/billing'
import { generatePayroll } from '../services/payroll.api'
import { PAYROLL_KEY } from './useEmployeePayroll'
import { LOCATION_PAYROLL_KEY } from './useLocationPayroll'

export function useGeneratePayroll() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: generatePayroll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYROLL_KEY] })
      queryClient.invalidateQueries({ queryKey: [LOCATION_PAYROLL_KEY] })
      // Payroll settles commission: refresh earnings / doctor reports.
      queryClient.invalidateQueries({ queryKey: billingKeys.commissions.all })
    },
  })
}
