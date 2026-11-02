import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { nowInClinic } from '@/lib/datetime'
import { payrollFormSchema } from '../schemas/employee.schema'
import type { PayrollFormValues } from '../schemas/employee.schema'
import { PayrollStatus } from '../types'
import type { PayrollRecord } from '../types'
import { useCreatePayroll } from './useCreatePayroll'
import { useUpdatePayroll } from './useUpdatePayroll'

function defaultsFor(
  record: PayrollRecord | null,
  defaultMonth?: number,
  defaultYear?: number,
): PayrollFormValues {
  const now = nowInClinic()
  if (record) {
    return {
      employeeId: record.employeeId,
      month: record.month,
      year: record.year,
      salaryAmount: String(Number(record.salaryAmount)),
      status: record.status,
      notes: record.notes ?? '',
    }
  }
  return {
    employeeId: '',
    month: defaultMonth ?? now.getMonth() + 1,
    year: defaultYear ?? now.getFullYear(),
    salaryAmount: '0',
    status: PayrollStatus.PENDING,
    notes: '',
  }
}

/** Create a manual payroll record, or edit one. Re-seeds on open. */
export function usePayrollForm({
  record,
  isOpen,
  defaultMonth,
  defaultYear,
  onDone,
}: {
  record: PayrollRecord | null
  isOpen: boolean
  defaultMonth?: number
  defaultYear?: number
  onDone: () => void
}) {
  const createMutation = useCreatePayroll()
  const updateMutation = useUpdatePayroll()

  const form = useForm({
    defaultValues: defaultsFor(record, defaultMonth, defaultYear),
    validators: { onChange: payrollFormSchema, onSubmit: payrollFormSchema },
    onSubmit: async ({ value }) => {
      const salaryAmount = Number(value.salaryAmount)
      try {
        if (record) {
          await updateMutation.mutateAsync({
            recordId: record.id,
            data: {
              salaryAmount,
              month: value.month,
              year: value.year,
              status: value.status,
              notes: value.notes,
            },
          })
        } else {
          await createMutation.mutateAsync({ ...value, salaryAmount })
        }
        onDone()
      } catch {
        // Hooks surface the error toast.
      }
    },
  })

  useEffect(() => {
    if (isOpen) form.reset(defaultsFor(record, defaultMonth, defaultYear))
  }, [isOpen, record, defaultMonth, defaultYear, form])

  return {
    form,
    isEdit: !!record,
    isPending: createMutation.isPending || updateMutation.isPending,
  }
}
