import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastLabError } from '@/features/labs'
import { useActiveLab } from '../hooks/useLabPortal'
import { labPortalKeys } from '../query-keys'
import { labProductionApi } from './production.api'
import { assignSchema, dispatchSchema } from './schemas'
import type { AssignValues, DispatchValues } from './schemas'
import type { LabProductionParams } from './types'

/** Production queries live under the active lab's portal key. */
const productionKeys = (labId: string | null) =>
  [...labPortalKeys.all, labId, 'production'] as const

export function useLabProductionItems(params: LabProductionParams) {
  const { labId } = useActiveLab()
  return useQuery({
    queryKey: [...productionKeys(labId), 'items', params],
    queryFn: () => labProductionApi.items(params),
    enabled: !!labId,
    placeholderData: keepPreviousData,
  })
}

/** Items the lab can put in a shipment now. */
export function useShippableItems(enabled: boolean) {
  const { labId } = useActiveLab()
  return useQuery({
    queryKey: [...productionKeys(labId), 'shippable'],
    queryFn: async () => {
      const [ready, inProduction] = await Promise.all([
        labProductionApi.items({ status: 'ready', page: 1, limit: 100 }),
        labProductionApi.items({
          status: 'in_production',
          page: 1,
          limit: 100,
        }),
      ])
      return [
        ...ready.data,
        ...inProduction.data.filter(
          (i) =>
            i.activeStage &&
            !i.activeStage.isFinal &&
            i.activeStage.status === 'at_lab',
        ),
      ]
    },
    enabled: !!labId && enabled,
  })
}

export function useLabShipments(params: {
  status?: string
  direction?: string
  page: number
  limit: number
}) {
  const { labId } = useActiveLab()
  return useQuery({
    queryKey: [...productionKeys(labId), 'shipments', params],
    queryFn: () => labProductionApi.shipments(params),
    enabled: !!labId,
    placeholderData: keepPreviousData,
  })
}

export function useLabRemakes(status?: string) {
  const { labId } = useActiveLab()
  return useQuery({
    queryKey: [...productionKeys(labId), 'remakes', status ?? 'all'],
    queryFn: () => labProductionApi.remakes(status),
    enabled: !!labId,
  })
}

export function useTechnicians() {
  const { labId } = useActiveLab()
  return useQuery({
    queryKey: [...productionKeys(labId), 'technicians'],
    queryFn: labProductionApi.technicians,
    enabled: !!labId,
  })
}

/** A production action: toasts, then refreshes the portal's queries. */
export function useLabProductionMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  success?: string | ((vars: TVars) => string),
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (_r, vars) => {
      const message = typeof success === 'function' ? success(vars) : success
      if (message) toast.success(message)
    },
    onError: toastLabError,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: labPortalKeys.all }),
  })
}

export function useDispatchForm({
  open,
  initialItemIds,
  onSubmit,
}: {
  open: boolean
  initialItemIds: string[]
  onSubmit: (v: DispatchValues) => Promise<unknown>
}) {
  const empty = (): DispatchValues => ({
    itemIds: initialItemIds,
    courierName: '',
    trackingNo: '',
    notes: '',
  })
  const form = useForm({
    defaultValues: empty(),
    validators: { onChange: dispatchSchema, onSubmit: dispatchSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  useEffect(() => {
    if (open) form.reset(empty())
  }, [open, form])
  return form
}

export function useAssignForm({
  current,
  open,
  onSubmit,
}: {
  current: string | null
  open: boolean
  onSubmit: (v: AssignValues) => Promise<unknown>
}) {
  const form = useForm({
    defaultValues: { labMemberId: current ?? '' } as AssignValues,
    validators: { onChange: assignSchema, onSubmit: assignSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  useEffect(() => {
    if (open) form.reset({ labMemberId: current ?? '' })
  }, [open, current, form])
  return form
}
