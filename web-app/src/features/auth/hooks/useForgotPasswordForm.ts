import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import apiClient from '@/lib/api'
import { forgotPasswordSchema } from '../schemas/auth.schema'
import type { ForgotPasswordFormValues } from '../schemas/auth.schema'

const defaultValues: ForgotPasswordFormValues = { email: '' }

/** Requests a password reset link; `success` flips once it was sent. */
export function useForgotPasswordForm() {
  const [globalError, setGlobalError] = useState('')
  const [success, setSuccess] = useState(false)

  const form = useForm({
    defaultValues,
    validators: {
      onChange: forgotPasswordSchema,
      onSubmit: forgotPasswordSchema,
    },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        await apiClient.post('/auth/forgot-password', value)
        setSuccess(true)
        toast.success('Reset link sent!', {
          description: 'Check your email inbox.',
        })
      } catch (err: any) {
        setGlobalError(
          err.response?.data?.message ||
            'Failed to process request. Try again.',
        )
      }
    },
  })

  return { form, globalError, success }
}
