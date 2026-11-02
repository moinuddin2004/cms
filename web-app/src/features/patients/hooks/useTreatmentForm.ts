import { useForm } from '@tanstack/react-form'
import { planTotals, useServiceCatalog } from '@/features/treatment-plans'
import type { PlanTemplate } from '@/features/plan-templates'
import { treatmentSchema } from '../schemas/treatment.schema'
import type { TreatmentFormValues } from '../schemas/treatment.schema'
import { useCreateTreatment } from './usePatientSubEntities'

const today = () => new Date().toISOString().slice(0, 10)

/** Record a treatment, optionally from a plan and/or linked to a visit. */
export function useTreatmentForm({
  patientId,
  encounterId,
  onSaved,
}: {
  patientId: string
  /** When set, the treatment is linked to this encounter (Flow E). */
  encounterId?: string
  onSaved: () => void
}) {
  const { mutate, isPending } = useCreateTreatment()

  const defaultValues: TreatmentFormValues = {
    planTemplateId: '',
    treatmentName: '',
    notes: '',
    cost: '',
    date: today(),
    encounterId: encounterId ?? '',
  }

  const { data: services = [] } = useServiceCatalog()
  const form = useForm({
    defaultValues,
    validators: { onChange: treatmentSchema, onSubmit: treatmentSchema },
    onSubmit: async ({ value }) => {
      const cost = value.cost.trim()
      mutate(
        {
          patientId,
          planTemplateId: value.planTemplateId || undefined,
          treatmentName: value.treatmentName.trim(),
          notes: value.notes || undefined,
          cost: cost === '' ? undefined : Number(cost),
          date: value.date || undefined,
          encounterId: value.encounterId || undefined,
        },
        {
          onSuccess: () => {
            form.reset()
            onSaved()
          },
        },
      )
    },
  })

  /**
   * Fill name + fee from the picked plan (or one of its services). Fees come
   * from the catalog (price viewers only); a whole plan gets its discount.
   */
  const applyPlan = (plan: PlanTemplate | undefined, item: string) => {
    if (!plan) return
    const picked = item === '' ? null : plan.items[Number(item)]
    form.setFieldValue('treatmentName', picked?.procedureName ?? plan.name)
    const priceOf = (serviceId: string | null) =>
      services.find((s) => s.id === serviceId)?.price
    const prices = plan.items.map((i) => priceOf(i.serviceId))
    const cost = picked
      ? priceOf(picked.serviceId)
      : prices.every((p) => p != null)
        ? planTotals(prices, plan.discountKind, plan.discountValue).final
        : null
    form.setFieldValue(
      'cost',
      cost == null ? '' : String(Math.round(Number(cost) * 100) / 100),
    )
  }

  return { form, isPending, applyPlan }
}
