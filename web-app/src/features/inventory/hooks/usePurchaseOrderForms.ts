import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { createPOSchema, receivePOSchema } from '../schemas/inventory.schema'
import type {
  CreatePOFormValues,
  ReceivePOFormValues,
} from '../schemas/inventory.schema'
import type { PurchaseOrder } from '../types'
import { useCreatePO, useReceivePOItems } from './usePurchaseOrders'

const CREATE_DEFAULTS: CreatePOFormValues = {
  supplierId: '',
  expectedDeliveryDate: '',
  taxRate: '0',
  notes: '',
  items: [],
}

/** Create a purchase order with line items. Resets each time it opens. */
export function useCreatePOForm({
  open,
  onDone,
}: {
  open: boolean
  onDone: () => void
}) {
  const createMutation = useCreatePO()

  const form = useForm({
    defaultValues: CREATE_DEFAULTS,
    validators: { onChange: createPOSchema, onSubmit: createPOSchema },
    onSubmit: async ({ value }) => {
      try {
        await createMutation.mutateAsync({
          supplierId: value.supplierId,
          expectedDeliveryDate: value.expectedDeliveryDate || undefined,
          taxRate: Number(value.taxRate) || 0,
          notes: value.notes.trim() || undefined,
          items: value.items.map((it) => ({
            inventoryItemId: it.inventoryItemId,
            orderedQuantity: Number(it.orderedQuantity),
            unitPrice: Number(it.unitPrice) || 0,
          })),
        })
        onDone()
      } catch {
        // error toast comes from the mutation hook
      }
    },
  })

  useEffect(() => {
    if (open) form.reset(CREATE_DEFAULTS)
  }, [open, form])

  return { form }
}

function receiveDefaults(po: PurchaseOrder): ReceivePOFormValues {
  return {
    items: (po.items ?? [])
      .filter((it) => Number(it.receivedQuantity) < Number(it.orderedQuantity))
      .map((it) => ({
        poItemId: it.id,
        name: it.inventoryItem?.name ?? '—',
        remaining: Number(it.orderedQuantity) - Number(it.receivedQuantity),
        receivedQuantity: '0',
        batchNumber: '',
        expiryDate: '',
      })),
  }
}

/** Receive some/all of a PO's outstanding lines. Re-seeds on open. */
export function useReceivePOForm({
  open,
  po,
  onDone,
}: {
  open: boolean
  po: PurchaseOrder
  onDone: () => void
}) {
  const receiveMutation = useReceivePOItems()

  const form = useForm({
    defaultValues: receiveDefaults(po),
    validators: { onChange: receivePOSchema, onSubmit: receivePOSchema },
    onSubmit: async ({ value }) => {
      const items = value.items
        .filter((r) => Number(r.receivedQuantity) > 0)
        .map((r) => ({
          poItemId: r.poItemId,
          receivedQuantity: Number(r.receivedQuantity),
          // blanks are dropped: the DTO's @IsDateString rejects ''
          batchNumber: r.batchNumber.trim() || undefined,
          expiryDate: r.expiryDate || undefined,
        }))
      try {
        await receiveMutation.mutateAsync({ id: po.id, items })
        onDone()
      } catch {
        // error toast comes from the mutation hook
      }
    },
  })

  useEffect(() => {
    if (open) form.reset(receiveDefaults(po))
    // re-seed per open / PO, not on every refetch of the same PO
  }, [open, po.id, form])

  return { form }
}
