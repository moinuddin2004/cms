import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import { apiErrorMessage } from '@/features/auth'
import {
  createInvite,
  fetchInvites,
  revokeInvite,
} from '../services/clinic-access.api'

export const invitesKey = (orgId: string | null) =>
  ['join-invites', orgId] as const

/** Open invite links of the active clinic. */
export function useInvites(enabled: boolean) {
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  return useQuery({
    queryKey: invitesKey(orgId),
    queryFn: fetchInvites,
    enabled: enabled && !!orgId,
  })
}

export function useCreateInvite() {
  const qc = useQueryClient()
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  return useMutation({
    mutationFn: createInvite,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: invitesKey(orgId) })
      toast.success('Invite link created', {
        description: 'Copy it and send it to your staff.',
      })
    },
    onError: (err) =>
      toast.error(apiErrorMessage(err, 'Could not create the link')),
  })
}

export function useRevokeInvite() {
  const qc = useQueryClient()
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  return useMutation({
    mutationFn: revokeInvite,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: invitesKey(orgId) })
      toast.success('Invite link turned off')
    },
    onError: (err) =>
      toast.error(apiErrorMessage(err, 'Could not turn the link off')),
  })
}

/** Full URL of an invite link in this web app. */
export const inviteUrl = (token: string) =>
  `${window.location.origin}/join/${token}`
