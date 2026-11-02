import { useEffect, useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import {
  creditNoteSchema,
  invoiceSchema,
  paymentSchema,
  refundSchema,
} from '../schemas/lab-billing.schema'
import type {
  CreditNoteValues,
  InvoiceValues,
  PaymentValues,
  RefundValues,
} from '../schemas/lab-billing.schema'

/**
 * Estimate / invoice form. `initial` is applied each time the sheet opens;
 * `subtotalOf` prices a selection so the discount can be checked.
 */
export function useInvoiceForm({
  open,
  initial,
  subtotalOf,
  onSubmit,
}: {
  open: boolean
  initial: InvoiceValues
  subtotalOf: (v: InvoiceValues) => number
  onSubmit: (v: InvoiceValues) => Promise<unknown>
}) {
  const form = useForm({
    defaultValues: initial,
    validators: {
      onChange: ({ value }) =>
        validate(invoiceSchema(subtotalOf(value)), value),
      onSubmit: ({ value }) =>
        validate(invoiceSchema(subtotalOf(value)), value),
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  useEffect(() => {
    if (open) form.reset(initial)
  }, [open, form])
  return form
}

export function usePaymentForm({
  open,
  initial,
  onSubmit,
}: {
  open: boolean
  initial: PaymentValues
  onSubmit: (v: PaymentValues) => Promise<unknown>
}) {
  const form = useForm({
    defaultValues: initial,
    validators: { onChange: paymentSchema, onSubmit: paymentSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  useEffect(() => {
    if (open) form.reset(initial)
  }, [open, form])
  return form
}

export function useCreditNoteForm({
  open,
  maxMinor,
  onSubmit,
}: {
  open: boolean
  maxMinor: number
  onSubmit: (v: CreditNoteValues) => Promise<unknown>
}) {
  const schema = useMemo(() => creditNoteSchema(maxMinor), [maxMinor])
  const empty: CreditNoteValues = { amount: '', reason: '' }
  const form = useForm({
    defaultValues: empty,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  useEffect(() => {
    if (open) form.reset(empty)
  }, [open, form])
  return form
}

export function useRefundForm({
  open,
  maxMinor,
  initialAmount,
  onSubmit,
}: {
  open: boolean
  maxMinor: number
  initialAmount: string
  onSubmit: (v: RefundValues) => Promise<unknown>
}) {
  const schema = useMemo(() => refundSchema(maxMinor), [maxMinor])
  const initial: RefundValues = {
    amount: initialAmount,
    method: 'cash',
    reference: '',
    reason: '',
  }
  const form = useForm({
    defaultValues: initial,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  useEffect(() => {
    if (open) form.reset(initial)
  }, [open, form])
  return form
}

/** Zod → TanStack Form field errors (for schemas built per render). */
function validate<T>(
  schema: {
    safeParse: (v: T) => {
      success: boolean
      error?: { issues: Array<{ path: PropertyKey[]; message: string }> }
    }
  },
  value: T,
) {
  const r = schema.safeParse(value)
  if (r.success) return undefined
  const fields: Record<string, string> = {}
  for (const issue of r.error?.issues ?? []) {
    const key = issue.path.map(String).join('.')
    fields[key] ??= issue.message
  }
  return { fields }
}
