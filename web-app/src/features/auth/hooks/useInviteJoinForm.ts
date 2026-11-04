import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { googleJoinRequest } from '../services/google.api'
import { apiErrorMessage, storeSession } from '../lib/applyLogin'
import { inviteJoinSchema } from '../schemas/auth.schema'
import type { InviteJoinFormValues } from '../schemas/auth.schema'

/** Send a join request through an invite link with the chosen Google account. */
export function useInviteJoinForm(token: string, credential: string | null) {
  const [globalError, setGlobalError] = useState('')
  const navigate = useNavigate()
  const defaultValues: InviteJoinFormValues = { phone: '', message: '' }

  const form = useForm({
    defaultValues,
    validators: { onChange: inviteJoinSchema, onSubmit: inviteJoinSchema },
    onSubmit: async ({ value }) => {
      if (!credential) return
      setGlobalError('')
      try {
        const message = value.message.trim()
        const session = await googleJoinRequest({
          credential,
          inviteToken: token,
          phone: value.phone.trim(),
          message: message || undefined,
        })
        storeSession(session)
        toast.success('Request sent', {
          description: 'You will get access once the clinic approves it.',
        })
        // `/` → the root guard shows the request status (/clinic-access).
        navigate({ to: '/', replace: true })
      } catch (err) {
        setGlobalError(
          apiErrorMessage(err, 'Could not send the request. Please try again.'),
        )
      }
    },
  })

  return { form, globalError }
}
