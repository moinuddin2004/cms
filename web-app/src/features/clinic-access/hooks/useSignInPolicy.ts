import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import { apiErrorMessage } from '@/features/auth'
import {
  fetchSignInPolicy,
  saveSignInPolicy,
} from '../services/clinic-access.api'
import {
  parseDomains,
  signInPolicySchema,
} from '../schemas/clinic-access.schema'
import type { SignInPolicyFormValues } from '../schemas/clinic-access.schema'
import type { SignInPolicy } from '../types'

export const signInPolicyKey = (orgId: string | null) =>
  ['clinic', orgId, 'sign-in-policy'] as const

export function useSignInPolicy(enabled = true) {
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  return useQuery({
    queryKey: signInPolicyKey(orgId),
    queryFn: fetchSignInPolicy,
    enabled: enabled && !!orgId,
  })
}

export const toFormValues = (p: SignInPolicy): SignInPolicyFormValues => ({
  googleEnabled: p.googleEnabled,
  requireGoogle: p.requireGoogle,
  googleDomains: p.googleDomains.join(', '),
  joinRequestsEnabled: p.joinRequestsEnabled,
})

/** Owner edits the clinic's sign-in policy (Settings → Sign-in policy). */
export function useSignInPolicyForm(policy: SignInPolicy) {
  const qc = useQueryClient()
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  const [globalError, setGlobalError] = useState('')

  const form = useForm({
    defaultValues: toFormValues(policy),
    validators: { onChange: signInPolicySchema, onSubmit: signInPolicySchema },
    onSubmit: async ({ value, formApi }) => {
      setGlobalError('')
      try {
        const { policy: saved } = await saveSignInPolicy({
          googleEnabled: value.googleEnabled,
          requireGoogle: value.requireGoogle,
          googleDomains: parseDomains(value.googleDomains),
          joinRequestsEnabled: value.joinRequestsEnabled,
        })
        qc.setQueryData(signInPolicyKey(orgId), (old: unknown) =>
          old && typeof old === 'object' ? { ...old, policy: saved } : old,
        )
        formApi.reset(toFormValues(saved))
        toast.success('Sign-in policy saved')
      } catch (err) {
        setGlobalError(apiErrorMessage(err, 'Could not save. Try again.'))
      }
    },
  })

  return { form, globalError }
}
