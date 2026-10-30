import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import apiClient from '@/lib/api'
import { resetPasswordSchema } from '../schemas/auth.schema'
import type { ResetPasswordFormValues } from '../schemas/auth.schema'

const defaultValues: ResetPasswordFormValues = {
  newPassword: '',
  confirmPassword: '',
}

/** Sets a new password with the emailed reset `token`. */
export function useResetPasswordForm(token: string) {
  const [globalError, setGlobalError] = useState('')
  const [success, setSuccess] = useState(false)

  const form = useForm({
    defaultValues,
    validators: {
      onChange: resetPasswordSchema,
      onSubmit: resetPasswordSchema,
    },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        await apiClient.patch('/auth/reset-password', {
          token,
          newPassword: value.newPassword,
        })
        setSuccess(true)
        toast.success('Password reset successful!')
      } catch (err: any) {
        const msg = err.response?.data?.message
        setGlobalError(
          Array.isArray(msg)
            ? msg[0]
            : msg || 'Failed to reset password. Link may be expired.',
        )
      }
    },
  })

  return { form, globalError, success }
}
