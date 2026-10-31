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
  procedureName: '',
  estimatedSessions: '1',
  estimatedCost: '',
})

function defaultsFor(template: PlanTemplate | null): PlanTemplateFormValues {
  return {
    name: template?.name ?? '',
    category: template?.category ?? PlanTemplateCategory.GENERAL,
    description: template?.description ?? '',
    items: template?.items.length
      ? template.items.map((i) => ({
          procedureName: i.procedureName,
          estimatedSessions: toInputValue(i.estimatedSessions),
          estimatedCost: toInputValue(i.estimatedCost),
        }))
      : [emptyPlanTemplateItem()],
  }
}

/** Create / edit one treatment plan template; blank procedure rows are dropped. */
export function usePlanTemplateForm({
  template,
  onSubmit,
}: {
  template: PlanTemplate | null
  onSubmit: (input: PlanTemplateInput) => void
}) {
  return useForm({
    defaultValues: defaultsFor(template),
    validators: { onChange: planTemplateSchema, onSubmit: planTemplateSchema },
    onSubmit: ({ value }) => {
      onSubmit({
        name: value.name.trim(),
        category: value.category,
        description: value.description.trim() || null,
        items: value.items
          .filter((i) => i.procedureName.trim())
          .map((i) => ({
            procedureName: i.procedureName.trim(),
            estimatedSessions: toNumber(i.estimatedSessions) || 1,
            estimatedCost: toNumberOrNull(i.estimatedCost),
            notes: null,
          })),
      })
    },
  })
}
