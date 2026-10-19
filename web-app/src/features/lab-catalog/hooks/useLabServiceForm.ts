import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { labServiceSchema } from '../schemas/catalog.schema'
import type { LabServiceFormValues } from '../schemas/catalog.schema'
import type { LabServiceItem } from '../types'
import { useSaveLabService } from './usePlatformCatalog'

const blank = (v: string) => v.trim() || null

function serviceDefaults(s: LabServiceItem | null): LabServiceFormValues {
  return {
    categoryId: s?.category.id ?? '',
    code: s?.code ?? '',
    name: s?.name ?? '',
    description: s?.description ?? '',
    unitType: s?.unitType ?? 'per_tooth',
    defaultTurnaroundDays: String(s?.defaultTurnaroundDays ?? 7),
    formSchemaId: s?.formSchema?.id ?? '',
    workflowTemplateId: s?.workflowTemplate?.id ?? '',
    stageTemplateId: s?.stageTemplate?.id ?? '',
  }
}

/** Create / edit a lab service. Re-seeds each time the sheet opens. */
export function useLabServiceForm({
  open,
  labId,
  service,
  onDone,
}: {
  open: boolean
  labId: string
  service: LabServiceItem | null
  onDone: () => void
}) {
  const save = useSaveLabService(labId, service)
  const form = useForm({
    defaultValues: serviceDefaults(service),
    validators: { onChange: labServiceSchema, onSubmit: labServiceSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        categoryId: value.categoryId,
        code: value.code.trim().toUpperCase(),
        name: value.name.trim(),
        description: blank(value.description),
        unitType: value.unitType,
        defaultTurnaroundDays: Number(value.defaultTurnaroundDays),
        formSchemaId: value.formSchemaId || null,
        workflowTemplateId: value.workflowTemplateId || null,
        stageTemplateId: value.stageTemplateId || null,
      })
      onDone()
    },
  })
  useEffect(() => {
    if (open) form.reset(serviceDefaults(service))
  }, [open, service, form])
  return { form, isEditing: !!service }
}
