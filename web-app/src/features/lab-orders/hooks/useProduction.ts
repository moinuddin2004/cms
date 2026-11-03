import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { toNumber } from '@/lib/zod-numbers'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastOrderError } from '../lib/order-errors'
import { labOrderKeys } from '../query-keys'
import {
  receiveShipmentSchema,
  remakeDecisionSchema,
  remakeRequestSchema,
  sendToLabSchema,
} from '../schemas/production.schema'
import type {
  ReceiveShipmentValues,
  RemakeDecisionValues,
  RemakeRequestValues,
  SendToLabValues,
} from '../schemas/production.schema'
import { productionApi } from '../services/production.api'
import type {
  ProductionItem,
  ReceiveLineInput,
  RemakeRequest,
  Shipment,
} from '../production.types'

/** Under `labOrderKeys.all`, so every order mutation refreshes it too. */
export const productionKey = (orderId: string) =>
  [...labOrderKeys.all, 'production', orderId] as const
export const shipmentTokenKey = (token: string) =>
  [...labOrderKeys.all, 'shipment-token', token] as const

export function useOrderProduction(orderId: string, enabled = true) {
  return useQuery({
    queryKey: productionKey(orderId),
    queryFn: () => productionApi.get(orderId),
    enabled,
  })
}

export function useShipmentByToken(token: string) {
  return useQuery({
    queryKey: shipmentTokenKey(token),
    queryFn: () => productionApi.shipmentByToken(token),
    retry: false,
  })
}

/** A production action: toasts, then refreshes orders + production. */
export function useProductionMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  success?: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      if (success) toast.success(success)
    },
    onError: toastOrderError,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: labOrderKeys.all }),
  })
}

/** Reject received work (→ remake) or request an after-care remake. */
export function useRemakeRequestForm({
  open,
  onSubmit,
}: {
  open: boolean
  onSubmit: (v: RemakeRequestValues) => Promise<unknown>
}) {
  const empty: RemakeRequestValues = { reasonCode: 'fit', notes: '' }
  const form = useForm({
    defaultValues: empty,
    validators: {
      onChange: remakeRequestSchema,
      onSubmit: remakeRequestSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  useEffect(() => {
    if (open) form.reset(empty)
  }, [open, form])
  return form
}

export function useRemakeDecisionForm({
  remake,
  onSubmit,
}: {
  remake: RemakeRequest | null
  onSubmit: (v: RemakeDecisionValues) => Promise<unknown>
}) {
  const initial = (): RemakeDecisionValues => ({
    decision: 'agree',
    responsibleParty: remake?.responsibleParty ?? 'undetermined',
    note: '',
  })
  const form = useForm({
    defaultValues: initial(),
    validators: {
      onChange: remakeDecisionSchema,
      onSubmit: remakeDecisionSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  useEffect(() => {
    if (remake) form.reset(initial())
  }, [remake?.id, form])
  return form
}

/** Every still-open line, prefilled as fully received in good order. */
export function receiveDefaults(
  shipment: Shipment | null,
): ReceiveShipmentValues {
  return {
    lines: (shipment?.lines ?? [])
      .filter((l) => !l.condition)
      .map((l) => ({
        shipmentItemId: l.id,
        label: `${l.orderNo ?? ''} · ${l.lineNo}. ${l.serviceName ?? ''}${
          l.stageName ? ` — ${l.stageName}` : ''
        }`,
        include: true,
        line: {
          quantity: l.quantity,
          receivedQty: String(l.quantity),
          condition: 'ok',
          qcResult: 'pass',
          qcNotes: '',
        },
      })),
  }
}

export const toReceiveLines = (v: ReceiveShipmentValues): ReceiveLineInput[] =>
  v.lines
    .filter((l) => l.include)
    .map((l) => ({
      shipmentItemId: l.shipmentItemId,
      receivedQty: toNumber(l.line.receivedQty),
      condition: l.line.condition,
      ...(l.line.condition !== 'missing' && l.line.qcResult
        ? { qcResult: l.line.qcResult }
        : {}),
      ...(l.line.qcNotes.trim() ? { qcNotes: l.line.qcNotes.trim() } : {}),
    }))

export function useReceiveShipmentForm({
  shipment,
  onSubmit,
}: {
  shipment: Shipment | null
  onSubmit: (lines: ReceiveLineInput[]) => Promise<unknown>
}) {
  const form = useForm({
    defaultValues: receiveDefaults(shipment),
    validators: {
      onChange: receiveShipmentSchema,
      onSubmit: receiveShipmentSchema,
    },
    onSubmit: async ({ value }) => {
      const lines = toReceiveLines(value)
      if (!lines.length) {
        toast.error('Choose at least one line to receive')
        return
      }
      await onSubmit(lines)
    },
  })
  useEffect(() => {
    form.reset(receiveDefaults(shipment))
  }, [shipment?.id, shipment?.version, form])
  return form
}

/** Items that can still go to the lab (not rejected / cancelled / done). */
const SENDABLE = (i: ProductionItem) =>
  !['rejected', 'cancelled', 'delivered'].includes(i.status ?? '')

export function sendToLabDefaults(items: ProductionItem[]): SendToLabValues {
  return {
    lines: items.filter(SENDABLE).map((i) => ({
      itemId: i.id,
      label: `${i.lineNo}. ${i.serviceName ?? ''}`,
      include: true,
      contents: 'impression',
      quantity: '1',
    })),
    courierName: '',
    trackingNo: '',
    notes: '',
  }
}

export function useSendToLabForm({
  open,
  items,
  onSubmit,
}: {
  open: boolean
  items: ProductionItem[]
  onSubmit: (
    body: Parameters<typeof productionApi.sendToLab>[0],
  ) => Promise<unknown>
}) {
  const form = useForm({
    defaultValues: sendToLabDefaults(items),
    validators: { onChange: sendToLabSchema, onSubmit: sendToLabSchema },
    onSubmit: async ({ value }) => {
      await onSubmit({
        lines: value.lines
          .filter((l) => l.include)
          .map((l) => ({
            itemId: l.itemId,
            contents: l.contents,
            quantity: toNumber(l.quantity),
          })),
        courierName: value.courierName.trim() || undefined,
        trackingNo: value.trackingNo.trim() || undefined,
        notes: value.notes.trim() || undefined,
      })
    },
  })
  useEffect(() => {
    if (open) form.reset(sendToLabDefaults(items))
  }, [open, form])
  return form
}
