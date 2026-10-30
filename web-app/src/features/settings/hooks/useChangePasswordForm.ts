import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import apiClient from '@/lib/api'
import { changePasswordSchema } from '../schemas/settings.schema'
import type { ChangePasswordFormValues } from '../schemas/settings.schema'

const defaultValues: ChangePasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

/** Change the signed-in user's password; other sessions are revoked. */
export function useChangePasswordForm() {
  const [globalError, setGlobalError] = useState('')

  const form = useForm({
    defaultValues,
    validators: {
      onChange: changePasswordSchema,
      onSubmit: changePasswordSchema,
    },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        await apiClient.post('/auth/change-password', {
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
          revokeOtherSessions: true,
        })
        toast.success('Password changed!', {
          description: 'Other sessions have been revoked.',
        })
        form.reset()
      } catch (err: any) {
        const msg = err.response?.data?.message
        setGlobalError(
          Array.isArray(msg) ? msg[0] : msg || 'Failed to change password',
        )
      }
    },
  })

  return { form, globalError }
}
