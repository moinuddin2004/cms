import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { labSchema } from '../schemas/lab.schema'
import type { LabFormValues } from '../schemas/lab.schema'
import type { Lab } from '../types'
import { useSaveLab } from './useLabDirectory'

const blank = (v: string) => v.trim() || null

function defaultsFor(lab: Lab | null): LabFormValues {
  return {
    name: lab?.name ?? '',
    labType: lab?.labType ?? 'external',
    ownerOrganizationId: lab?.ownerOrganization?.id ?? '',
    phone: lab?.phone ?? '',
    whatsappPhone: lab?.whatsappPhone ?? '',
    email: lab?.email ?? '',
    city: lab?.city ?? '',
    address: lab?.address ?? '',
  }
}

/** Create / edit a platform lab. Re-seeds each time the sheet opens. */
export function useLabForm({
  open,
  lab,
  onDone,
}: {
  open: boolean
  lab: Lab | null
  onDone: () => void
}) {
  const save = useSaveLab(lab)
  const form = useForm({
    defaultValues: defaultsFor(lab),
    validators: { onChange: labSchema, onSubmit: labSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        name: value.name.trim(),
        labType: value.labType,
        ownerOrganizationId:
          value.labType === 'internal' ? value.ownerOrganizationId : undefined,
        phone: blank(value.phone),
        whatsappPhone: blank(value.whatsappPhone),
        email: blank(value.email),
        city: blank(value.city),
        address: blank(value.address),
      })
      onDone()
    },
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(lab))
  }, [open, lab, form])

  return { form, isEditing: !!lab }
}
