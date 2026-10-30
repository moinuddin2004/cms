import { z } from 'zod'

export const isCashAmount = (v: string | undefined) =>
  /^\d+(\.\d{1,2})?$/.test((v ?? '').trim())

/** Expected total per account, and whether staff must count it (cash). */
export interface CashCloseCheck {
  paymentAccountId: string
  expected: number
  needs: boolean
}

export const cashVariance = (check: CashCloseCheck, raw: string | undefined) =>
  check.needs && isCashAmount(raw)
    ? Math.round((Number(raw) - check.expected) * 100) / 100
    : 0

/**
 * Close the counter (mirrors CreateCashCloseDto): every counted account
 * needs an amount ≥ 0 with max 2 decimals, and any variance needs a note
 * (≤ 500 chars). Built per preview because the counted accounts vary.
 */
export function makeCashCloseSchema(checks: CashCloseCheck[]) {
  return z
    .object({
      counted: z.record(z.string(), z.string().optional()),
      note: z.string().max(500, 'At most 500 characters'),
    })
    .superRefine((v, ctx) => {
      let hasVariance = false
      for (const c of checks) {
        if (!c.needs) continue
        const raw = v.counted[c.paymentAccountId]
        if (!isCashAmount(raw)) {
          ctx.addIssue({
            code: 'custom',
            path: ['counted', c.paymentAccountId],
            message: (raw ?? '').trim()
              ? 'Enter an amount (max 2 decimals)'
              : 'Enter the counted amount',
          })
        } else if (cashVariance(c, raw) !== 0) {
          hasVariance = true
        }
      }
      if (hasVariance && !v.note.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['note'],
          message: 'Explain the difference',
        })
      }
    })
}

export type CashCloseFormValues = z.input<
  ReturnType<typeof makeCashCloseSchema>
>
