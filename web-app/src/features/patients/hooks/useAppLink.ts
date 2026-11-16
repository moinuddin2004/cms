import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createClaimToken,
  fetchAppLink,
  revokeAppLink,
} from '../services/appLink.api'

const KEY = 'patient-app-link'

/** Link status; polls every 5 s while the dialog is open (a claim shows up live). */
export function useAppLinkStatus(patientId: string, enabled: boolean) {
  return useQuery({
    queryKey: [KEY, patientId],
    queryFn: () => fetchAppLink(patientId),
    enabled,
    refetchInterval: enabled ? 5000 : false,
  })
}

function errorCode(e: unknown): string | undefined {
  const body = (
    e as {
      response?: { data?: { code?: string; error?: { code?: string } } }
    }
  ).response?.data
  return body?.code ?? body?.error?.code
}

/** The token is a bearer secret: kept in mutation state only, never cached or logged. */
export function useCreateClaimToken(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => createClaimToken(patientId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, patientId] }),
    onError: (e: unknown) => {
      const c = errorCode(e)
      toast.error(
        c === 'ALREADY_LINKED'
          ? 'This patient is already linked to an app account'
          : c === 'CLINIC_SUSPENDED'
            ? 'This clinic is suspended — new links are paused'
            : c === 'PATIENT_APP_DISABLED'
              ? 'The patient app is not enabled for this clinic'
              : 'Could not create a link code',
      )
    },
  })
}

export function useRevokeAppLink(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => revokeAppLink(patientId),
    onSuccess: () => {
      toast.success('App link revoked')
      qc.invalidateQueries({ queryKey: [KEY, patientId] })
    },
    onError: () => toast.error('Could not revoke the app link'),
  })
}
