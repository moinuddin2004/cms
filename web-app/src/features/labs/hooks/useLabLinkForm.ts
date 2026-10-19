import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { labLinkSchema } from '../schemas/lab.schema'
import type { LabLinkFormValues } from '../schemas/lab.schema'
import type { LabLink } from '../types'
import { useSaveLabLink } from './useLabLinks'

const DEFAULT_TERMS_DAYS = '30'

function defaultsFor(link: LabLink | null): LabLinkFormValues {
  return {
    labId: link?.lab.id ?? '',
    paymentTermsDays: String(link?.paymentTermsDays ?? DEFAULT_TERMS_DAYS),
    patientDataLevel: link?.patientDataLevel ?? 'full_name',
    notes: link?.notes ?? '',
  }
}

/**
 * Add a lab to the clinic's list (pick from the directory + terms) or edit
 * the terms of one already there.
 */
export function useLabLinkForm({
  open,
  link,
  onDone,
}: {
  open: boolean
  link: LabLink | null
  onDone: () => void
}) {
  const save = useSaveLabLink(link)
  const form = useForm({
    defaultValues: defaultsFor(link),
    validators: {
      onChange: labLinkSchema,
      onSubmit: labLinkSchema.refine((v) => !!link || !!v.labId, {
        path: ['labId'],
        message: 'Choose a lab',
      }),
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        labId: link ? undefined : value.labId,
        paymentTermsDays: Number(value.paymentTermsDays),
        patientDataLevel: value.patientDataLevel,
        notes: value.notes.trim() || null,
      })
      onDone()
    },
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(link))
  }, [open, link, form])

  return { form, isEditing: !!link }
}
