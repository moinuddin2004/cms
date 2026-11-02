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

/** Starting values for a new plan made from elsewhere (e.g. the dental chart). */
export type TreatmentPlanPrefill = {
  notes?: string
  /** One service line per tooth; the service is still picked by hand. */
  teeth?: string[]
}

function defaultsFor(
  plan: TreatmentPlan | null,
  prefill?: TreatmentPlanPrefill,
): TreatmentPlanFormValues {
  if (!plan && prefill) {
    const teeth = (prefill.teeth ?? []).slice(0, 50)
    return {
      planTemplateId: '',
      planName: '',
      notes: (prefill.notes ?? '').slice(0, 2000),
      items: teeth.length
        ? teeth.map((t) => ({ ...emptyPlanLine(), toothNumber: t }))
        : [emptyPlanLine()],
      discountKind: '',
      discountValue: '',
    }
  }
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
  prefill,
  canDiscount,
  onSubmit,
}: {
  plan: TreatmentPlan | null
  prefill?: TreatmentPlanPrefill
  canDiscount: boolean
  onSubmit: (input: TreatmentPlanInput) => void
}) {
  return useForm({
    defaultValues: defaultsFor(plan, prefill),
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
