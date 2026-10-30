import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { templateSchema } from '../schemas/inventory.schema'
import type { TemplateFormValues } from '../schemas/inventory.schema'
import type { ConsumptionTemplate, TemplateFormData } from '../types'
import { useCreateTemplate, useUpdateTemplate } from './useConsumptionTemplates'

function defaultsFor(template: ConsumptionTemplate | null): TemplateFormValues {
  return {
    name: template?.name ?? '',
    procedureName: template?.procedureName ?? '',
    appointmentType: template?.appointmentType ?? '',
    items: (template?.items ?? []).map((it) => ({
      inventoryItemId: it.inventoryItemId,
      name: it.inventoryItem?.name ?? 'Item',
      unit: it.inventoryItem?.unit ?? '',
      quantity: String(Number(it.quantity)),
      notes: it.notes ?? '',
    })),
  }
}

/** Create / edit a consumption template (kit). Re-seeds on open. */
export function useTemplateForm({
  open,
  template,
  onDone,
}: {
  open: boolean
  template: ConsumptionTemplate | null
  onDone: () => void
}) {
  const createMutation = useCreateTemplate()
  const updateMutation = useUpdateTemplate()

  const form = useForm({
    defaultValues: defaultsFor(template),
    validators: { onChange: templateSchema, onSubmit: templateSchema },
    onSubmit: async ({ value }) => {
      const payload: TemplateFormData = {
        name: value.name.trim(),
        procedureName: value.procedureName.trim(),
        appointmentType: value.appointmentType || undefined,
        items: value.items.map((it, i) => ({
          inventoryItemId: it.inventoryItemId,
          quantity: Number(it.quantity),
          notes: it.notes.trim() || undefined,
          sortOrder: i,
        })),
      }
      try {
        if (template) {
          await updateMutation.mutateAsync({ id: template.id, payload })
        } else {
          await createMutation.mutateAsync(payload)
        }
        onDone()
      } catch {
        // error toast comes from the mutation hook
      }
    },
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(template))
  }, [open, template, form])

  return { form, isEdit: !!template }
}
