import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { leaveFormSchema } from '../schemas/employee.schema'
import type { LeaveFormValues } from '../schemas/employee.schema'
import { LeaveType } from '../types'
import type { EmployeeLeave } from '../types'
import { useCreateLeave, useUpdateLeave } from './useLeave'

const defaultsFor = (leave?: EmployeeLeave | null): LeaveFormValues => ({
  leaveType: leave?.leaveType ?? LeaveType.ANNUAL,
  startDate: leave?.startDate ?? '',
  endDate: leave?.endDate ?? '',
  reason: leave?.reason ?? '',
})

/** Create / edit a leave request. Re-seeds each time the dialog opens. */
export function useLeaveForm({
  employeeId,
  isOpen,
  leave,
  onDone,
}: {
  employeeId: string
  isOpen: boolean
  leave?: EmployeeLeave | null
  onDone: () => void
}) {
  const createMutation = useCreateLeave()
  const updateMutation = useUpdateLeave()

  const form = useForm({
    defaultValues: defaultsFor(leave),
    validators: { onChange: leaveFormSchema, onSubmit: leaveFormSchema },
    onSubmit: async ({ value }) => {
      try {
        if (leave) {
          await updateMutation.mutateAsync({ id: leave.id, payload: value })
        } else {
          await createMutation.mutateAsync({ ...value, employeeId })
        }
        onDone()
      } catch {
        // toast handled in hooks
      }
    },
  })

  useEffect(() => {
    if (isOpen) form.reset(defaultsFor(leave))
  }, [isOpen, leave, form])

  return {
    form,
    isEditing: !!leave,
    isPending: createMutation.isPending || updateMutation.isPending,
  }
}
