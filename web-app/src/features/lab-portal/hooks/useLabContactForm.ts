import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { labContactSchema } from '../schemas/lab-portal.schema'
import type { LabContactFormValues } from '../schemas/lab-portal.schema'
import type { PortalLab } from '../types'
import { useUpdatePortalLab } from './useLabPortal'

const valuesOf = (lab: PortalLab | null): LabContactFormValues => ({
  phone: lab?.phone ?? '',
  whatsappPhone: lab?.whatsappPhone ?? '',
  email: lab?.email ?? '',
  city: lab?.city ?? '',
  address: lab?.address ?? '',
})

const orNull = (v: string) => v.trim() || null

/** Edit the lab's contact details. Resets to the latest data on each open. */
export function useLabContactForm({
  open,
  lab,
  onDone,
}: {
  open: boolean
  lab: PortalLab | null
  onDone: () => void
}) {
  const update = useUpdatePortalLab()
  const form = useForm({
    defaultValues: valuesOf(lab),
    validators: { onChange: labContactSchema, onSubmit: labContactSchema },
    onSubmit: async ({ value }) => {
      if (!lab) return
      await update.mutateAsync({
        phone: orNull(value.phone),
        whatsappPhone: orNull(value.whatsappPhone),
        email: orNull(value.email)?.toLowerCase() ?? null,
        city: orNull(value.city),
        address: orNull(value.address),
        version: lab.version,
      })
      onDone()
    },
  })

  useEffect(() => {
    if (open) form.reset(valuesOf(lab))
  }, [open, lab, form])

  return form
}
