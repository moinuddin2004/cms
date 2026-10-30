import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import apiClient from '@/lib/api'
import { isLabOnlyUser, useAuthStore } from '@/store/useAuthStore'
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
  const setAuth = useAuthStore((state) => state.setAuth)
  const navigate = useNavigate()

  const form = useForm({
    defaultValues,
    validators: { onChange: loginSchema, onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        const response = await apiClient.post('/auth/login', value)

        if (response.data?.isSuccess) {
          const {
            user,
            accessToken,
            isSuperAdmin,
            accessSource,
            requiresOrgSelection,
            requiresLocationSelection,
            accessibleOrganizations,
            activeOrganizationId,
            activeLocationId,
            labMemberships = [],
          } = response.data.data

          setAuth({
            user,
            accessToken,
            isSuperAdmin,
            accessSource,
            requiresOrgSelection,
            requiresLocationSelection,
            accessibleOrganizations,
            activeOrganizationId,
            activeLocationId,
            labMemberships,
          })

          toast.success('Welcome back!', {
            description: `Logged in as ${user.name || user.email}`,
          })

          // Redirect based on what selection is needed
          if (
            isLabOnlyUser({
              isSuperAdmin,
              accessibleOrganizations: accessibleOrganizations ?? [],
              labMemberships,
            })
          ) {
            navigate({ to: '/lab-portal' })
          } else if (requiresOrgSelection || requiresLocationSelection) {
            navigate({ to: '/select-location' })
          } else {
            navigate({ to: '/' }) // → the user's home page
          }
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
