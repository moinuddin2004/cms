import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { createOwnClinic } from '../services/google.api'
import { apiErrorMessage, storeSession } from '../lib/applyLogin'
import { createClinicSchema } from '../schemas/auth.schema'
import type { CreateClinicFormValues } from '../schemas/auth.schema'

/** A signed-in user with no clinic creates one (it awaits approval). */
export function useCreateClinicForm() {
  const [globalError, setGlobalError] = useState('')
  const defaultValues: CreateClinicFormValues = { clinicName: '', phone: '' }

  const form = useForm({
    defaultValues,
    validators: { onChange: createClinicSchema, onSubmit: createClinicSchema },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        const phone = value.phone.trim()
        const session = await createOwnClinic({
          clinicName: value.clinicName.trim(),
          phone: phone || undefined,
        })
        // The new clinic is active and awaiting approval — the page
        // switches to the "awaiting approval" view on its own.
        storeSession(session)
        toast.success('Your clinic has been created', {
          description: 'You can use it as soon as it is approved.',
        })
      } catch (err) {
        setGlobalError(
          apiErrorMessage(err, 'Could not create the clinic. Try again.'),
        )
      }
    },
  })

  return { form, globalError }
}
