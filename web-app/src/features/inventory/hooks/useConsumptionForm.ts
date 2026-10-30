import { useForm } from '@tanstack/react-form'
import { consumptionSchema } from '../schemas/inventory.schema'
import type { ConsumptionFormValues } from '../schemas/inventory.schema'
import { useRecordConsumption } from './usePatientConsumption'

const DEFAULTS: ConsumptionFormValues = {
  templateId: '',
  notes: '',
  lines: [],
}

/** Record the items used on a patient during a visit. */
export function useConsumptionForm({
  patientId,
  appointmentId,
  treatmentPlanId,
  onSaved,
}: {
  patientId: string
  appointmentId?: string
  treatmentPlanId?: string
  onSaved?: () => void
}) {
  const recordMutation = useRecordConsumption()

  const form = useForm({
    defaultValues: DEFAULTS,
    validators: { onChange: consumptionSchema, onSubmit: consumptionSchema },
    onSubmit: async ({ value }) => {
      try {
        await recordMutation.mutateAsync({
          patientId,
          appointmentId,
          treatmentPlanId,
          templateId: value.templateId || undefined,
          notes: value.notes.trim() || undefined,
          items: value.lines
            .filter((l) => Number(l.quantity) > 0)
            .map((l) => ({
              inventoryItemId: l.inventoryItemId,
              quantity: Number(l.quantity),
              wasFromTemplate: l.wasFromTemplate,
            })),
        })
        onSaved?.()
      } catch {
        // error toast comes from the mutation hook
      }
    },
  })

  return { form }
}
