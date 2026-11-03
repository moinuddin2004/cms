import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { rupeesToMinor } from '@/features/lab-catalog'
import { chargeRequestSchema } from '../schemas/lab-order-actions.schema'
import type { ChargeRequestValues } from '../schemas/lab-order-actions.schema'
import type { ChargeRequestInput } from '../types'

const EMPTY: ChargeRequestValues = {
  kind: 'material',
  amount: '',
  reason: '',
  itemId: '',
}

/** Raise an extra charge; resets each time the sheet opens. */
export function useChargeRequestForm({
  open,
  onSubmit,
}: {
  open: boolean
  onSubmit: (body: ChargeRequestInput) => Promise<unknown>
}) {
  const form = useForm({
    defaultValues: EMPTY,
    validators: {
      onChange: chargeRequestSchema,
      onSubmit: chargeRequestSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        kind: value.kind,
        amountMinor: rupeesToMinor(value.amount) ?? 0,
        reason: value.reason.trim(),
        itemId: value.itemId || null,
      })
    },
  })
  useEffect(() => {
    if (open) form.reset(EMPTY)
  }, [open, form])
  return form
}
