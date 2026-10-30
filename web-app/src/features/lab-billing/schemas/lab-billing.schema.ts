import { z } from 'zod'
import { rupeesToPaisa } from '@/features/lab-catalog'

const text = (n: number) => z.string().trim().max(n, `At most ${n} characters`)

/** Rupees as typed ("4500.5"), checked to be a whole number of paisa. */
const rupees = (opts: { min?: number; max?: number; label?: string } = {}) =>
  z.string().superRefine((v, ctx) => {
    const p = rupeesToPaisa(v)
    if (p === null) {
      ctx.addIssue({ code: 'custom', message: 'Enter an amount, e.g. 4500' })
      return
    }
    if (opts.min !== undefined && p < opts.min)
      ctx.addIssue({
        code: 'custom',
        message: `${opts.label ?? 'Amount'} must be more than 0`,
      })
    if (opts.max !== undefined && p > opts.max)
      ctx.addIssue({
        code: 'custom',
        message: `${opts.label ?? 'Amount'} can be at most ${(opts.max / 100).toLocaleString('en-PK')}`,
      })
  })

/** "17" or "17.5" (%) → basis points. */
export function percentToBp(v: string): number | null {
  const m = /^\s*(\d{1,3})(?:\.(\d{1,2}))?\s*$/.exec(v)
  if (!m) return null
  const bp =
    Number(m[1]) * 100 +
    Number(((m[2] as string | undefined) ?? '').padEnd(2, '0'))
  return bp <= 10_000 ? bp : null
}

/** New estimate / invoice from a lab order (or edit of an estimate). */
export const invoiceSchema = (subtotalPaisa: number) =>
  z
    .object({
      itemIds: z.array(z.string()),
      chargeIds: z.array(z.string()),
      discount: z.string(),
      taxPercent: z.string(),
      notes: text(1000),
      issue: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (v.itemIds.length + v.chargeIds.length === 0)
        ctx.addIssue({
          code: 'custom',
          path: ['itemIds'],
          message: 'Pick at least one item to bill',
        })
      const d = v.discount.trim() ? rupeesToPaisa(v.discount) : 0
      if (d === null)
        ctx.addIssue({
          code: 'custom',
          path: ['discount'],
          message: 'Enter an amount, e.g. 2000',
        })
      else if (d > subtotalPaisa)
        ctx.addIssue({
          code: 'custom',
          path: ['discount'],
          message: 'More than the selected items',
        })
      if (percentToBp(v.taxPercent || '0') === null)
        ctx.addIssue({
          code: 'custom',
          path: ['taxPercent'],
          message: 'A percentage from 0 to 100',
        })
    })
export type InvoiceValues = z.input<ReturnType<typeof invoiceSchema>>

export const PAYMENT_TARGETS = ['invoice', 'auto', 'advance'] as const

/** Collect a payment; `maxPaisa` caps it when it settles one invoice only. */
export const paymentSchema = z.object({
  amount: rupees({ min: 1 }),
  method: z.enum(['cash', 'card', 'bank_transfer', 'wallet']),
  reference: text(80),
  notes: text(500),
  target: z.enum(PAYMENT_TARGETS),
})
export type PaymentValues = z.input<typeof paymentSchema>

export const creditNoteSchema = (maxPaisa: number) =>
  z.object({
    amount: rupees({ min: 1, max: maxPaisa }),
    reason: text(500).min(3, 'Say why (at least 3 characters)'),
  })
export type CreditNoteValues = z.input<ReturnType<typeof creditNoteSchema>>

export const refundSchema = (maxPaisa: number) =>
  z.object({
    amount: rupees({ min: 1, max: maxPaisa }),
    method: z.enum(['cash', 'card', 'bank_transfer', 'wallet']),
    reference: text(80),
    reason: text(500).min(3, 'Say why (at least 3 characters)'),
  })
export type RefundValues = z.input<ReturnType<typeof refundSchema>>

/** Reason for a money correction (void etc.; backend `ReasonDto`: 3–500). */
export const correctionReasonSchema = z.object({
  reason: text(500).min(3, 'Say why (at least 3 characters)'),
})
