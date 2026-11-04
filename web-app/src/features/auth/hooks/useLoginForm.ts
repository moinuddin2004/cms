import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import apiClient from '@/lib/api'
import { homeAfterLogin, storeSession } from '../lib/applyLogin'
import type { LoginPayload } from '../lib/applyLogin'
import { loginSchema } from '../schemas/auth.schema'
import type { LoginFormValues } from '../schemas/auth.schema'

const defaultValues: LoginFormValues = {
  email: '',
  password: '',
  rememberMe: false,
}

/** Sign in, store the session, then route to the right home screen. */
export function useLoginForm() {
  const [globalError, setGlobalError] = useState('')
  const navigate = useNavigate()

  const form = useForm({
    defaultValues,
    validators: { onChange: loginSchema, onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        const response = await apiClient.post('/auth/login', value)

        if (response.data?.isSuccess) {
          const session = response.data.data as LoginPayload
          storeSession(session)
          toast.success('Welcome back!', {
            description: `Logged in as ${session.user.name || session.user.email}`,
          })
          navigate({ to: homeAfterLogin(session) })
        }
      } catch (err: any) {
        const msg = err.response?.data?.message
        setGlobalError(
          Array.isArray(msg)
            ? msg[0]
            : msg || 'Failed to login. Please try again.',
        )
      }
    },
  })

  return { form, globalError }
}
