import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { orderTemplateSchema } from '../schemas/catalog.schema'
import type { OrderTemplateFormValues } from '../schemas/catalog.schema'
import type { OrderTemplate } from '../types'
import { useSaveOrderTemplate } from './useClinicCatalog'

const blank = (v: string) => v.trim() || null

export const emptyTemplateItem =
  (): OrderTemplateFormValues['items'][number] => ({
    labServiceId: '',
    optionIds: [],
    quantity: '1',
    rush: false,
    answers: {},
  })

function templateDefaults(t: OrderTemplate | null): OrderTemplateFormValues {
  return {
    name: t?.name ?? '',
    shared: t?.shared ?? false,
    notes: t?.body.notes ?? '',
    items: t
      ? t.body.items.map((i) => ({
          labServiceId: i.labServiceId,
          optionIds: i.optionIds,
          quantity: String(i.quantity),
          rush: i.rush,
          answers: i.answers,
        }))
      : [emptyTemplateItem()],
  }
}

export function useOrderTemplateForm({
  open,
  template,
  onDone,
}: {
  open: boolean
  template: OrderTemplate | null
  onDone: () => void
}) {
  const save = useSaveOrderTemplate(template)
  const form = useForm({
    defaultValues: templateDefaults(template),
    validators: {
      onChange: orderTemplateSchema,
      onSubmit: orderTemplateSchema,
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        name: value.name.trim(),
        shared: value.shared,
        notes: blank(value.notes),
        items: value.items.map((i) => ({
          labServiceId: i.labServiceId,
          optionIds: i.optionIds,
          quantity: Number(i.quantity),
          rush: i.rush,
          answers: dropEmpty(i.answers),
        })),
      })
      onDone()
    },
  })
  useEffect(() => {
    if (open) form.reset(templateDefaults(template))
  }, [open, template, form])
  return { form, isEditing: !!template }
}

/** Unanswered pre-fill fields are left out rather than sent empty. */
function dropEmpty(answers: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(answers).filter(
      ([, v]) => v !== '' && v !== null && v !== undefined,
    ),
  )
}
