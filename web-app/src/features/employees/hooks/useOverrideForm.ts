import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { overrideFormSchema } from '../schemas/employee.schema'
import type { OverrideFormValues } from '../schemas/employee.schema'
import type { AvailabilityOverride, OverrideFormData } from '../types'
import {
  useCreateOverride,
  useUpdateOverride,
} from './useAvailabilityOverrides'

const defaultsFor = (
  override?: AvailabilityOverride | null,
): OverrideFormValues => ({
  date: override?.date ?? '',
  isAvailable: override?.isAvailable ?? false,
  reason: override?.reason ?? '',
  overrideHours: override?.overrideHours ?? [],
})

/** Create / edit a date-specific availability override. Re-seeds on open. */
export function useOverrideForm({
  employeeId,
  isOpen,
  override,
  onDone,
}: {
  employeeId: string
  isOpen: boolean
  override?: AvailabilityOverride | null
  onDone: () => void
}) {
  const createMutation = useCreateOverride(employeeId)
  const updateMutation = useUpdateOverride(employeeId)

  const form = useForm({
    defaultValues: defaultsFor(override),
    validators: { onChange: overrideFormSchema, onSubmit: overrideFormSchema },
    onSubmit: async ({ value }) => {
      const payload: OverrideFormData = {
        date: value.date,
        isAvailable: value.isAvailable,
        reason: value.reason,
        overrideHours: value.isAvailable ? value.overrideHours : undefined,
      }
      try {
        if (override) {
          await updateMutation.mutateAsync({ id: override.id, payload })
        } else {
          await createMutation.mutateAsync(payload)
        }
        onDone()
      } catch {
        // toast handled in hooks
      }
    },
  })

  useEffect(() => {
    if (isOpen) form.reset(defaultsFor(override))
  }, [isOpen, override, form])

  return {
    form,
    isEditing: !!override,
    isPending: createMutation.isPending || updateMutation.isPending,
  }
}
