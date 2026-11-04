import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { addPassword, apiErrorMessage } from '@/features/auth'
import { setPasswordSchema } from '../schemas/settings.schema'
import type { SetPasswordFormValues } from '../schemas/settings.schema'
import { loginMethodsKey } from './useLoginMethods'

const defaultValues: SetPasswordFormValues = {
  newPassword: '',
  confirmPassword: '',
}

/** Add a password to an account that only signs in with Google. */
export function useSetPasswordForm() {
  const [globalError, setGlobalError] = useState('')
  const qc = useQueryClient()

  const form = useForm({
    defaultValues,
    validators: { onChange: setPasswordSchema, onSubmit: setPasswordSchema },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        await addPassword(value.newPassword)
        toast.success('Password set', {
          description: 'You can now also sign in with your email and password.',
        })
        form.reset()
        await qc.invalidateQueries({ queryKey: loginMethodsKey })
      } catch (err) {
        setGlobalError(apiErrorMessage(err, 'Could not set the password'))
      }
    },
  })

  return { form, globalError }
}
