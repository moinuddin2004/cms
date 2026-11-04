import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import apiClient from '@/lib/api'
import { storeSession } from '../lib/applyLogin'
import type { LoginPayload } from '../lib/applyLogin'
import { registerSchema } from '../schemas/auth.schema'
import type { RegisterFormValues } from '../schemas/auth.schema'

const defaultValues: RegisterFormValues = {
  clinicName: '',
  name: '',
  phone: '',
  email: '',
  password: '',
}

/** Self-signup: creates the clinic (awaiting approval) and signs in. */
export function useRegisterForm() {
  const [globalError, setGlobalError] = useState('')
  const navigate = useNavigate()

  const form = useForm({
    defaultValues,
    validators: { onChange: registerSchema, onSubmit: registerSchema },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        const phone = value.phone.trim()
        const response = await apiClient.post('/auth/register', {
          ...value,
          clinicName: value.clinicName.trim(),
          phone: phone || undefined,
        })

        if (response.data?.isSuccess) {
          // Signup also signs in (same payload as /auth/login).
          storeSession(response.data.data as LoginPayload)
          toast.success('Your clinic has been created', {
            description: 'You can use it as soon as it is approved.',
          })
          // `/` → the root guard shows the "awaiting approval" screen.
          navigate({ to: '/' })
        }
      } catch (err: any) {
        const msg = err.response?.data?.message
        setGlobalError(
          Array.isArray(msg)
            ? msg[0]
            : msg || 'Registration failed. Please try again.',
        )
      }
    },
  })

  return { form, globalError }
}
