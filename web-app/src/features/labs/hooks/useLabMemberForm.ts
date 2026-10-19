import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { labMemberSchema } from '../schemas/lab.schema'
import type { LabMemberFormValues } from '../schemas/lab.schema'
import { useAddLabMember } from './useLabDirectory'

const EMPTY: LabMemberFormValues = { email: '', role: 'lab_technician' }

/** Add an existing account to a lab's staff. Resets each time the sheet opens. */
export function useLabMemberForm({
  open,
  labId,
  onDone,
}: {
  open: boolean
  labId: string
  onDone: () => void
}) {
  const add = useAddLabMember(labId)
  const form = useForm({
    defaultValues: EMPTY,
    validators: { onChange: labMemberSchema, onSubmit: labMemberSchema },
    onSubmit: async ({ value }) => {
      await add.mutateAsync({
        email: value.email.trim().toLowerCase(),
        role: value.role,
      })
      onDone()
    },
  })

  useEffect(() => {
    if (open) form.reset(EMPTY)
  }, [open, form])

  return form
}
