import { useEffect, useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import { makeCashCloseSchema } from '../schemas/cash-close.schema'
import type {
  CashCloseCheck,
  CashCloseFormValues,
} from '../schemas/cash-close.schema'
import { reportsApi } from '../services/billing-v2.api'
import { useBillingMutation } from './use-billing-mutation'

const empty = (): CashCloseFormValues => ({ counted: {}, note: '' })

/**
 * Counted amounts + note for closing the counter. Re-seeds every time the
 * sheet opens; `onClosed` gets the new cash-close id.
 */
export function useCashCloseForm({
  open,
  periodEnd,
  checks,
  onClosed,
}: {
  open: boolean
  periodEnd: string | undefined
  checks: CashCloseCheck[]
  onClosed: (id: string) => void
}) {
  const create = useBillingMutation(reportsApi.createCashClose, {
    success: 'Counter closed',
  })
  const schema = useMemo(() => makeCashCloseSchema(checks), [checks])

  const form = useForm({
    defaultValues: empty(),
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      if (!periodEnd) return
      try {
        const closed = await create.mutateAsync({
          periodEnd,
          lines: checks.map((c) => ({
            paymentAccountId: c.paymentAccountId,
            ...(c.needs
              ? { counted: Number(value.counted[c.paymentAccountId]) }
              : {}),
          })),
          note: value.note.trim() || undefined,
        })
        onClosed(closed.id)
      } catch {
        // Toasted by useBillingMutation.
      }
    },
  })

  useEffect(() => {
    if (open) form.reset(empty())
  }, [open, form])

  return form
}
