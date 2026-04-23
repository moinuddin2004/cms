import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { payrollApi } from '@/api/payroll.api'
import { PayrollRecord } from '@/types/employee.types'

export const useEmployeePayroll = (employeeId: string) =>
  useQuery({
    queryKey: ['payroll', employeeId],
    queryFn: () =>
      payrollApi.getByEmployee(employeeId).then((r) => r.data.data),
    enabled: !!employeeId,
  })

export const useGeneratePayroll = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: payrollApi.generate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
    },
  })
}

export const useMarkPaid = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      recordId,
      data,
    }: {
      recordId: string
      data: any
      employeeId: string
    }) => payrollApi.markPaid(recordId, data),
    // Optimistic update
    onMutate: async ({ recordId, employeeId }) => {
      await queryClient.cancelQueries({ queryKey: ['payroll', employeeId] })
      const previousPayroll = queryClient.getQueryData(['payroll', employeeId])

      queryClient.setQueryData(
        ['payroll', employeeId],
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
    onError: (err, { employeeId }, context) => {
      if (context?.previousPayroll) {
        queryClient.setQueryData(
          ['payroll', employeeId],
          context.previousPayroll,
        )
      }
    },
    onSettled: (_, __, { employeeId }) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', employeeId] })
    },
  })
}
