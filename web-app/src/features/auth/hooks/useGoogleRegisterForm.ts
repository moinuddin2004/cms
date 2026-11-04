import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { googleJoinRequest, googleRegister } from '../services/google.api'
import { useGoogleSignupStore } from '../store/useGoogleSignupStore'
import { apiErrorMessage, storeSession } from '../lib/applyLogin'
import { googleRegisterSchema, joinRequestSchema } from '../schemas/auth.schema'
import type {
  GoogleRegisterFormValues,
  JoinRequestFormValues,
} from '../schemas/auth.schema'

/** Create a clinic owned by the verified Google account in the signup store. */
export function useGoogleRegisterForm() {
  const [globalError, setGlobalError] = useState('')
  const navigate = useNavigate()
  const credential = useGoogleSignupStore((s) => s.credential)
  const clear = useGoogleSignupStore((s) => s.clear)

  const defaultValues: GoogleRegisterFormValues = { clinicName: '', phone: '' }
  const form = useForm({
    defaultValues,
    validators: {
      onChange: googleRegisterSchema,
      onSubmit: googleRegisterSchema,
    },
    onSubmit: async ({ value }) => {
      if (!credential) return
      setGlobalError('')
      try {
        const phone = value.phone.trim()
        const session = await googleRegister({
          credential,
          clinicName: value.clinicName.trim(),
          phone: phone || undefined,
        })
        clear()
        storeSession(session)
        toast.success('Your clinic has been created', {
          description: 'You can use it as soon as it is approved.',
        })
        navigate({ to: '/' })
      } catch (err) {
        setGlobalError(
          apiErrorMessage(err, 'Registration failed. Please try again.'),
        )
      }
    },
  })

  return { form, globalError }
}

/** Ask to join a clinic with the verified Google account in the signup store. */
export function useJoinRequestForm(defaultOrganizationId: string) {
  const [globalError, setGlobalError] = useState('')
  const navigate = useNavigate()
  const credential = useGoogleSignupStore((s) => s.credential)
  const clear = useGoogleSignupStore((s) => s.clear)

  const defaultValues: JoinRequestFormValues = {
    organizationId: defaultOrganizationId,
    phone: '',
    message: '',
  }
  const form = useForm({
    defaultValues,
    validators: { onChange: joinRequestSchema, onSubmit: joinRequestSchema },
    onSubmit: async ({ value }) => {
      if (!credential) return
      setGlobalError('')
      try {
        const message = value.message.trim()
        const session = await googleJoinRequest({
          credential,
          organizationId: value.organizationId,
          phone: value.phone.trim(),
          message: message || undefined,
        })
        clear()
        storeSession(session)
        toast.success('Request sent', {
          description: 'You will get access once the clinic approves it.',
        })
        navigate({ to: '/' })
      } catch (err) {
        setGlobalError(
          apiErrorMessage(err, 'Could not send the request. Please try again.'),
        )
      }
    },
  })

  return { form, globalError }
}
