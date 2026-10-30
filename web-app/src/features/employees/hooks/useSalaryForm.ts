import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { salaryFormSchema } from '../schemas/employee.schema'
import type { SalaryFormValues } from '../schemas/employee.schema'
import { useUpdateSalary } from './useSetSalary'

const defaultsFor = (currentSalary?: number): SalaryFormValues => ({
  grossSalary: currentSalary ? String(currentSalary) : '',
})

/** Set an employee's gross salary. Re-seeds each time the dialog opens. */
export function useSalaryForm({
  employeeId,
  isOpen,
  currentSalary,
  onDone,
}: {
  employeeId: string
  isOpen: boolean
  currentSalary?: number
  onDone: () => void
}) {
  const updateSalaryMutation = useUpdateSalary(employeeId)

  const form = useForm({
    defaultValues: defaultsFor(currentSalary),
    validators: { onChange: salaryFormSchema, onSubmit: salaryFormSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateSalaryMutation.mutateAsync({
          grossSalary: Number(value.grossSalary),
        })
        toast.success('Salary updated')
        onDone()
      } catch {
        toast.error('Failed to update salary')
      }
    },
  })

  useEffect(() => {
    if (isOpen) form.reset(defaultsFor(currentSalary))
  }, [isOpen, currentSalary, form])

  return { form, isPending: updateSalaryMutation.isPending }
}
