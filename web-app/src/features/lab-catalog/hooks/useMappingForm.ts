import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { mappingSchema } from '../schemas/catalog.schema'
import type { MappingFormValues } from '../schemas/catalog.schema'
import { useCreateMapping } from './useClinicCatalog'

/** Map a lab service to a clinic treatment; either side may be pre-picked. */
export function useMappingForm({
  open,
  initial,
  onDone,
}: {
  open: boolean
  initial: Partial<MappingFormValues>
  onDone: () => void
}) {
  const create = useCreateMapping()
  const defaults = (): MappingFormValues => ({
    clinicTreatmentId: initial.clinicTreatmentId ?? '',
    labServiceId: initial.labServiceId ?? '',
    isDefault: initial.isDefault ?? false,
  })
  const form = useForm({
    defaultValues: defaults(),
    validators: { onChange: mappingSchema, onSubmit: mappingSchema },
    onSubmit: async ({ value }) => {
      await create.mutateAsync(value)
      onDone()
    },
  })
  useEffect(() => {
    if (open) form.reset(defaults())
  }, [open, initial.clinicTreatmentId, initial.labServiceId, form])
  return { form }
}
