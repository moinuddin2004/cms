import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import { useAccess } from '@/features/access'
import { apiErrorMessage } from '@/features/auth'
import {
  approveJoinRequest,
  fetchJoinRequests,
  rejectJoinRequest,
} from '../services/clinic-access.api'
import { approveJoinRequestSchema } from '../schemas/clinic-access.schema'
import type { ApproveJoinRequestFormValues } from '../schemas/clinic-access.schema'

export const joinRequestsKey = (orgId: string | null) =>
  ['join-requests', orgId, 'pending'] as const

/** Pending join requests of the active clinic (needs `employees.manage`). */
export function usePendingJoinRequests() {
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  const access = useAccess()
  return useQuery({
    queryKey: joinRequestsKey(orgId),
    queryFn: () => fetchJoinRequests('pending'),
    enabled:
      !!orgId && access.status === 'ready' && access.can('employees.manage'),
    staleTime: 60_000,
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  return () => {
    void qc.invalidateQueries({ queryKey: joinRequestsKey(orgId) })
    void qc.invalidateQueries({ queryKey: ['employees'] })
  }
}

/** Approve a request: creates the employee here with the chosen role. */
export function useApproveJoinRequestForm(
  requestId: string | null,
  onDone: () => void,
) {
  const [globalError, setGlobalError] = useState('')
  const invalidate = useInvalidate()
  const defaultValues: ApproveJoinRequestFormValues = {
    designation: '',
    employmentRoleId: '',
  }

  const form = useForm({
    defaultValues,
    validators: {
      onChange: approveJoinRequestSchema,
      onSubmit: approveJoinRequestSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      if (!requestId) return
      setGlobalError('')
      try {
        await approveJoinRequest(requestId, {
          designation: value.designation.trim(),
          employmentRoleId: value.employmentRoleId || undefined,
        })
        toast.success('Request approved', {
          description: 'They can sign in with Google now.',
        })
        invalidate()
        formApi.reset()
        onDone()
      } catch (err) {
        setGlobalError(apiErrorMessage(err, 'Could not approve. Try again.'))
      }
    },
  })

  return { form, globalError, setGlobalError }
}

export function useRejectJoinRequest() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      rejectJoinRequest(id, reason),
    onSuccess: () => {
      toast.success('Request declined')
      invalidate()
    },
    onError: (err) =>
      toast.error(apiErrorMessage(err, 'Could not decline. Try again.')),
  })
}
