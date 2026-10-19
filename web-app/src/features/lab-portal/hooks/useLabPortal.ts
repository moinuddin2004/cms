import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastLabError } from '@/features/labs'
import { useAuthStore } from '@/store/useAuthStore'
import { labPortalKeys } from '../query-keys'
import { labPortalApi } from '../services/lab-portal.api'
import type {
  LabContactInput,
  LabMember,
  LabMemberRole,
  PortalClinic,
  PortalClinicParams,
  PortalLinkAction,
} from '../types'

/** The lab the portal is showing, and the caller's membership of it. */
export function useActiveLab() {
  const labs = useAuthStore((s) => s.labMemberships)
  const activeLabId = useAuthStore((s) => s.activeLabId)
  const setActiveLab = useAuthStore((s) => s.setActiveLab)
  const userId = useAuthStore((s) => s.user?.uuid ?? null)
  const membership = labs.find((l) => l.labId === activeLabId) ?? null
  return {
    labs,
    labId: membership?.labId ?? null,
    membership,
    isLabAdmin: membership?.role === 'lab_admin',
    userId,
    setActiveLab,
  }
}

export function usePortalLab() {
  const { labId } = useActiveLab()
  return useQuery({
    queryKey: labPortalKeys.lab(labId),
    queryFn: labPortalApi.lab,
    enabled: !!labId,
  })
}

export function usePortalMembers(enabled = true) {
  const { labId } = useActiveLab()
  return useQuery({
    queryKey: labPortalKeys.members(labId),
    queryFn: labPortalApi.members,
    enabled: !!labId && enabled,
  })
}

export function usePortalClinics(params: PortalClinicParams) {
  const { labId } = useActiveLab()
  return useQuery({
    queryKey: labPortalKeys.clinics(labId, params),
    queryFn: () => labPortalApi.clinics(params),
    enabled: !!labId,
    placeholderData: (prev) => prev,
  })
}

/**
 * A portal mutation: toasts the outcome and refreshes every portal query —
 * also after a STALE_VERSION conflict, so the next try uses fresh data.
 */
function usePortalMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  success?: string | ((result: TResult, vars: TVars) => string),
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, vars) => {
      const message =
        typeof success === 'function' ? success(result, vars) : success
      if (message) toast.success(message)
    },
    onError: toastLabError,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: labPortalKeys.all }),
  })
}

export function useUpdatePortalLab() {
  return usePortalMutation(
    (body: Partial<LabContactInput> & { version: number }) =>
      labPortalApi.updateLab(body),
    'Lab details updated',
  )
}

export function useAddPortalMember() {
  return usePortalMutation(
    (body: { email: string; role: LabMemberRole }) =>
      labPortalApi.addMember(body),
    'Member added',
  )
}

export function useUpdatePortalMember() {
  return usePortalMutation(
    ({
      member,
      ...change
    }: {
      member: LabMember
      role?: LabMemberRole
      isActive?: boolean
    }) =>
      labPortalApi.updateMember(member.id, {
        ...change,
        version: member.version,
      }),
    (m) => (m.isActive ? 'Member updated' : 'Member deactivated'),
  )
}

const TRANSITION_SUCCESS: Record<PortalLinkAction, string> = {
  activate: 'Clinic accepted',
  suspend: 'Clinic suspended',
  reactivate: 'Clinic reactivated',
}

export function usePortalClinicTransition() {
  return usePortalMutation(
    ({
      link,
      action,
      reason,
    }: {
      link: PortalClinic
      action: PortalLinkAction
      reason?: string
    }) =>
      labPortalApi.transitionClinic(link.id, {
        action,
        version: link.version,
        reason,
      }),
    (_link, vars) => TRANSITION_SUCCESS[vars.action],
  )
}
