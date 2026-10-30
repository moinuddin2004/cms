import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import apiClient from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
import { registerSchema } from '../schemas/auth.schema'
import type { RegisterFormValues } from '../schemas/auth.schema'

const defaultValues: RegisterFormValues = {
  clinicName: '',
  name: '',
  phone: '',
  email: '',
  password: '',
}

/** Self-signup: creates the clinic, signs in, then opens the setup wizard. */
export function useRegisterForm() {
  const [globalError, setGlobalError] = useState('')
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

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
          const d = response.data.data
          setAuth({
            user: d.user,
            accessToken: d.accessToken,
            isSuperAdmin: d.isSuperAdmin,
            accessSource: d.accessSource,
            requiresOrgSelection: d.requiresOrgSelection,
            requiresLocationSelection: d.requiresLocationSelection,
            accessibleOrganizations: d.accessibleOrganizations,
            activeOrganizationId: d.activeOrganizationId,
            activeLocationId: d.activeLocationId,
            labMemberships: d.labMemberships ?? [],
          })
          toast.success('Your clinic is ready', {
            description: 'Your 14-day free trial has started.',
          })
          navigate({ to: '/setup' })
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
