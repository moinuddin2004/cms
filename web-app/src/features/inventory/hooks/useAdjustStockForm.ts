import { useEffect, useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import {
  makeAdjustStockSchema,
  signedAdjustment,
} from '../schemas/inventory.schema'
import type { AdjustStockFormValues } from '../schemas/inventory.schema'
import type { InventoryItem } from '../types'
import { useAdjustStock } from './useInventory'

const DEFAULTS: AdjustStockFormValues = {
  movementType: 'MANUAL_ADJUSTMENT',
  quantity: '0',
  direction: 'increase',
  batchNumber: '',
  expiryDate: '',
  notes: '',
}

/** Manual stock movement for one item. Resets each time the dialog opens. */
export function useAdjustStockForm({
  open,
  item,
  onDone,
}: {
  open: boolean
  item: InventoryItem | null
  onDone: () => void
}) {
  const adjustMutation = useAdjustStock()
  const current = Number(item?.currentStock ?? 0)
  const schema = useMemo(() => makeAdjustStockSchema(current), [current])

  const form = useForm({
    defaultValues: DEFAULTS,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      if (!item) return
      try {
        await adjustMutation.mutateAsync({
          id: item.id,
          payload: {
            // MANUAL_ADJUSTMENT sends the signed quantity; others send positive.
            quantity:
              value.movementType === 'MANUAL_ADJUSTMENT'
                ? signedAdjustment(value)
                : Math.abs(Number(value.quantity)),
            movementType: value.movementType,
            batchNumber: value.batchNumber.trim() || undefined,
            expiryDate: value.expiryDate || undefined,
            notes: value.notes.trim() || undefined,
          },
        })
        onDone()
      } catch {
        // error toast comes from the mutation hook
      }
    },
  })

  useEffect(() => {
    if (open) form.reset(DEFAULTS)
  }, [open, form])

  return { form, current }
}
