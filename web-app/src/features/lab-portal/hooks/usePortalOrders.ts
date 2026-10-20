import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastOrderError } from '@/features/lab-orders'
import { labPortalKeys } from '../query-keys'
import {
  magicLinkApi,
  portalOrdersApi,
} from '../services/lab-portal-orders.api'
import type { LabActionsApi, PortalOrderParams } from '../types'
import { useActiveLab } from './useLabPortal'

export function usePortalOrders(params: PortalOrderParams) {
  const { labId } = useActiveLab()
  return useQuery({
    queryKey: labPortalKeys.orders(labId, params),
    queryFn: () => portalOrdersApi.list(params),
    enabled: !!labId,
    placeholderData: keepPreviousData,
  })
}

export function usePortalOrder(id: string) {
  const { labId } = useActiveLab()
  return useQuery({
    queryKey: labPortalKeys.order(labId, id),
    queryFn: () => portalOrdersApi.get(id),
    enabled: !!labId,
  })
}

export function usePortalOrderActions(id: string) {
  const { labId } = useActiveLab()
  return useQuery({
    queryKey: labPortalKeys.orderActions(labId, id),
    queryFn: () => portalOrdersApi.actions(id),
    enabled: !!labId,
  })
}

/** Toast + refresh every portal query (also after a stale-version error). */
function usePortalOrderMutation<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
  success: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => toast.success(success),
    onError: toastOrderError,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: labPortalKeys.all }),
  })
}

/** The lab's answers through the portal (`via = portal`). */
export function usePortalOrderAnswers(id: string): LabActionsApi {
  const accept = usePortalOrderMutation(
    (b: Parameters<LabActionsApi['accept']>[0]) =>
      portalOrdersApi.accept(id, b),
    'Order accepted — the clinic has been told',
  )
  const reject = usePortalOrderMutation(
    (b: Parameters<LabActionsApi['reject']>[0]) =>
      portalOrdersApi.reject(id, b),
    'Order rejected',
  )
  const clarify = usePortalOrderMutation(
    (b: Parameters<LabActionsApi['clarify']>[0]) =>
      portalOrdersApi.clarify(id, b),
    'Question sent to the clinic',
  )
  const move = usePortalOrderMutation(
    (b: Parameters<NonNullable<LabActionsApi['changeExpectedDate']>>[0]) =>
      portalOrdersApi.changeExpectedDate(id, b),
    'Expected date changed — the doctor has been told',
  )
  return {
    accept: accept.mutateAsync,
    reject: reject.mutateAsync,
    clarify: clarify.mutateAsync,
    changeExpectedDate: move.mutateAsync,
  }
}

export function usePortalNote(id: string) {
  return usePortalOrderMutation(
    (body: string) => portalOrdersApi.note(id, body),
    'Message sent',
  )
}

export function useAcknowledgeRevision(id: string) {
  return usePortalOrderMutation(
    (revisionNo: number) => portalOrdersApi.acknowledge(id, revisionNo),
    'Revision marked as read',
  )
}

// ── no-login magic link ─────────────────────────────────────────────────

export function useMagicLink(token: string) {
  return useQuery({
    queryKey: labPortalKeys.magicLink(token),
    queryFn: () => magicLinkApi.view(token),
    retry: false,
  })
}

/** The lab's answers through a magic link (`via = magic_link`). */
export function useMagicLinkAnswers(token: string): LabActionsApi {
  const queryClient = useQueryClient()
  const make =
    <TVars>(fn: (v: TVars) => Promise<unknown>, success: string) =>
    async (v: TVars) => {
      try {
        await fn(v)
        toast.success(success)
      } catch (err) {
        toastOrderError(err)
        throw err
      } finally {
        await queryClient.invalidateQueries({
          queryKey: labPortalKeys.magicLink(token),
        })
      }
    }
  return {
    accept: make(
      (b: Parameters<LabActionsApi['accept']>[0]) =>
        magicLinkApi.accept(token, b),
      'Order accepted — the clinic has been told',
    ),
    reject: make(
      (b: Parameters<LabActionsApi['reject']>[0]) =>
        magicLinkApi.reject(token, b),
      'Order rejected',
    ),
    clarify: make(
      (b: Parameters<LabActionsApi['clarify']>[0]) =>
        magicLinkApi.clarify(token, b),
      'Question sent to the clinic',
    ),
  }
}
