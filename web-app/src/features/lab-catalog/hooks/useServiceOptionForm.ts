import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { minorToRupeesText, rupeesToMinor } from '../lib/money'
import { serviceOptionSchema } from '../schemas/catalog.schema'
import type { ServiceOptionFormValues } from '../schemas/catalog.schema'
import type { ServiceOption } from '../types'
import { useSaveOption } from './usePlatformCatalog'

function optionDefaults(o: ServiceOption | null): ServiceOptionFormValues {
  return {
    optionType: o?.optionType ?? 'material',
    code: o?.code ?? '',
    name: o?.name ?? '',
    extraCost: o ? minorToRupeesText(o.extraCostMinor) : '',
  }
}

export function useServiceOptionForm({
  open,
  labId,
  serviceId,
  option,
  onDone,
}: {
  open: boolean
  labId: string
  serviceId: string
  option: ServiceOption | null
  onDone: () => void
}) {
  const save = useSaveOption(labId, serviceId, option)
  const form = useForm({
    defaultValues: optionDefaults(option),
    validators: {
      onChange: serviceOptionSchema,
      onSubmit: serviceOptionSchema,
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        optionType: value.optionType,
        code: value.code.trim().toUpperCase(),
        name: value.name.trim(),
        extraCostMinor: rupeesToMinor(value.extraCost) ?? 0,
      })
      onDone()
    },
  })
  useEffect(() => {
    if (open) form.reset(optionDefaults(option))
  }, [open, option, form])
  return { form, isEditing: !!option }
}
