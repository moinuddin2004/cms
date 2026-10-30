import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { markPaidFormSchema } from '../schemas/employee.schema'
import type { MarkPaidFormValues } from '../schemas/employee.schema'
import { PaymentMethod } from '../types'
import { useMarkPaid } from './useMarkPaid'

const DEFAULTS: MarkPaidFormValues = {
  paymentMethod: PaymentMethod.BANK_TRANSFER,
  paymentReference: '',
  notes: '',
}

/** Mark one payroll record as paid. Resets each time the dialog opens. */
export function useMarkPaidForm({
  record,
  isOpen,
  onDone,
}: {
  record: { id: string; employeeId: string } | null
  isOpen: boolean
  onDone: () => void
}) {
  const markPaidMutation = useMarkPaid()

  const form = useForm({
    defaultValues: DEFAULTS,
    validators: { onChange: markPaidFormSchema, onSubmit: markPaidFormSchema },
    onSubmit: async ({ value }) => {
      if (!record) return
      try {
        await markPaidMutation.mutateAsync({
          recordId: record.id,
          employeeId: record.employeeId,
          data: value,
        })
        toast.success('✅ Salary marked as paid')
        onDone()
      } catch {
        toast.error('Failed to mark as paid')
      }
    },
  })

  useEffect(() => {
    if (isOpen) form.reset(DEFAULTS)
  }, [isOpen, form])

  return { form, isPending: markPaidMutation.isPending }
}
