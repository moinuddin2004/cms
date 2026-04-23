import { useMutation, useQueryClient } from '@tanstack/react-query'
import { markPayrollPaid } from '../services/payroll.api'
import { PAYROLL_KEY } from './useEmployeePayroll'
import type { MarkPaidFormData, PayrollRecord } from '../types'

export function useMarkPaid() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      recordId,
      data,
    }: {
      recordId: string
      data: MarkPaidFormData
      employeeId: string
    }) => markPayrollPaid(recordId, data),
    // Optimistic update
    onMutate: async ({ recordId, employeeId }) => {
      await queryClient.cancelQueries({ queryKey: [PAYROLL_KEY, employeeId] })
      const previousPayroll = queryClient.getQueryData([PAYROLL_KEY, employeeId])

      queryClient.setQueryData(
        [PAYROLL_KEY, employeeId],
        (old: PayrollRecord[] | undefined) => {
          if (!old) return old
          return old.map((record) =>
            record.id === recordId
              ? { ...record, status: 'paid' as const }
              : record,
          )
        },
      )

      return { previousPayroll }
    },
    onError: (_err, { employeeId }, context) => {
      if (context?.previousPayroll) {
        queryClient.setQueryData(
          [PAYROLL_KEY, employeeId],
          context.previousPayroll,
        )
      }
    },
    onSettled: (_, __, { employeeId }) => {
      queryClient.invalidateQueries({ queryKey: [PAYROLL_KEY, employeeId] })
    },
  })
}
