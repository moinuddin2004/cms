import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { portalMemberSchema } from '../schemas/lab-portal.schema'
import type { PortalMemberFormValues } from '../schemas/lab-portal.schema'
import { useAddPortalMember } from './useLabPortal'

const EMPTY: PortalMemberFormValues = { email: '', role: 'lab_technician' }

/** Add an existing account to the lab's team. Resets each time it opens. */
export function usePortalMemberForm({
  open,
  onDone,
}: {
  open: boolean
  onDone: () => void
}) {
  const add = useAddPortalMember()
  const form = useForm({
    defaultValues: EMPTY,
    validators: { onChange: portalMemberSchema, onSubmit: portalMemberSchema },
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
