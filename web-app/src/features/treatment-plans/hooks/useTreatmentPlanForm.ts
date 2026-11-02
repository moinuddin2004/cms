import { useForm } from '@tanstack/react-form'
import { toInputValue, toNumber, toNumberOrNull } from '@/lib/zod-numbers'
import { treatmentPlanSchema } from '../schemas/treatmentPlan.schema'
import type {
  PlanLineValues,
  TreatmentPlanFormValues,
} from '../schemas/treatmentPlan.schema'
import type { DiscountKind, TreatmentPlan, TreatmentPlanInput } from '../types'

export const emptyPlanLine = (): PlanLineValues => ({
  id: '',
  serviceId: '',
  toothNumber: '',
  estimatedSessions: '1',
})

function defaultsFor(plan: TreatmentPlan | null): TreatmentPlanFormValues {
  return {
    planTemplateId: plan?.planTemplateId ?? '',
    planName: plan?.planName ?? '',
    notes: plan?.notes ?? '',
    items: plan?.items.length
      ? plan.items.map((i) => ({
          id: i.id,
          serviceId: i.serviceId ?? '',
          toothNumber: i.toothNumber ?? '',
          estimatedSessions: toInputValue(i.estimatedSessions),
        }))
      : [emptyPlanLine()],
    discountKind: plan?.discountKind ?? '',
    discountValue: toInputValue(plan?.discountValue),
  }
}

/**
 * Create / edit a patient's plan. `canDiscount` = the user may give a
 * discount; otherwise none is sent and the server keeps the template's.
 */
export function useTreatmentPlanForm({
  plan,
  canDiscount,
  onSubmit,
}: {
  plan: TreatmentPlan | null
  canDiscount: boolean
  onSubmit: (input: TreatmentPlanInput) => void
}) {
  return useForm({
    defaultValues: defaultsFor(plan),
    validators: {
      onChange: treatmentPlanSchema,
      onSubmit: treatmentPlanSchema,
    },
    onSubmit: ({ value }) => {
      const kind = (value.discountKind || null) as DiscountKind | null
      onSubmit({
        planName: value.planName.trim() || undefined,
        planTemplateId: plan ? undefined : value.planTemplateId || undefined,
        notes: value.notes.trim() || null,
        items: value.items.map((i) => ({
          ...(i.id ? { id: i.id } : {}),
          serviceId: i.serviceId,
          toothNumber: i.toothNumber.trim() || null,
          estimatedSessions: toNumber(i.estimatedSessions) || 1,
          notes: null,
        })),
        ...(canDiscount
          ? {
              discountKind: kind,
              discountValue: kind ? toNumberOrNull(value.discountValue) : null,
            }
          : {}),
      })
    },
  })
}
