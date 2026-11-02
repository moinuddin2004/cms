import { useForm } from '@tanstack/react-form'
import { toInputValue, toNumber, toNumberOrNull } from '@/lib/zod-numbers'
import { planTemplateSchema } from '../schemas/planTemplate.schema'
import type {
  PlanTemplateFormValues,
  PlanTemplateItemValues,
} from '../schemas/planTemplate.schema'
import { PlanTemplateCategory } from '../types'
import type { PlanTemplate, PlanTemplateInput } from '../types'

export const emptyPlanTemplateItem = (): PlanTemplateItemValues => ({
  serviceId: '',
  procedureName: '',
  estimatedSessions: '1',
})

/**
 * A predefined step not linked to a service yet is matched to a catalog
 * service by name; otherwise the row asks for one.
 */
function defaultsFor(
  template: PlanTemplate | null,
  serviceIdByName: Map<string, string>,
): PlanTemplateFormValues {
  return {
    name: template?.name ?? '',
    category: template?.category ?? PlanTemplateCategory.GENERAL,
    description: template?.description ?? '',
    items: template?.items.length
      ? template.items.map((i) => ({
          serviceId:
            i.serviceId ??
            serviceIdByName.get(i.procedureName.toLowerCase()) ??
            '',
          procedureName: i.procedureName,
          estimatedSessions: toInputValue(i.estimatedSessions),
        }))
      : [emptyPlanTemplateItem()],
    discountKind: template?.discountKind ?? '',
    discountValue: toInputValue(template?.discountValue),
  }
}

/** Create / edit one treatment plan template. */
export function usePlanTemplateForm({
  template,
  serviceIdByName,
  onSubmit,
}: {
  template: PlanTemplate | null
  serviceIdByName: Map<string, string>
  onSubmit: (input: PlanTemplateInput) => void
}) {
  return useForm({
    defaultValues: defaultsFor(template, serviceIdByName),
    validators: { onChange: planTemplateSchema, onSubmit: planTemplateSchema },
    onSubmit: ({ value }) => {
      const kind = value.discountKind || null
      onSubmit({
        name: value.name.trim(),
        category: value.category,
        description: value.description.trim() || null,
        items: value.items.map((i) => ({
          serviceId: i.serviceId,
          estimatedSessions: toNumber(i.estimatedSessions) || 1,
          notes: null,
        })),
        discountKind: kind,
        discountValue: kind ? toNumberOrNull(value.discountValue) : null,
      })
    },
  })
}
