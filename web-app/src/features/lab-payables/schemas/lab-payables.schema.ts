import { z } from 'zod'
import { rupeesToMinor } from '@/features/lab-catalog'

const text = (n: number) => z.string().trim().max(n, `At most ${n} characters`)
const rupees = (label: string) =>
  z
    .string()
    .trim()
    .refine(
      (v) => rupeesToMinor(v) !== null,
      `${label}: enter an amount like 4500 or 4500.50`,
    )

/** "17" / "12.5" → basis points; null when not 0–100 with ≤ 2 decimals. */
export function percentToBp(v: string): number | null {
  const m = /^\s*(\d{1,3})(?:\.(\d{0,2}))?\s*$/.exec(v)
  if (!m) return null
  const bp =
    Number(m[1]) * 100 +
    Number(((m[2] as string | undefined) ?? '').padEnd(2, '0'))
  return bp <= 10_000 ? bp : null
}

/** Approve a draft bill: the lab's invoice no., due date, tax. */
export const approveBillSchema = z.object({
  vendorInvoiceNo: text(60),
  dueOn: z.string(),
  taxPercent: z
    .string()
    .trim()
    .refine((v) => percentToBp(v) !== null, 'Tax: 0–100 %'),
})
export type ApproveBillValues = z.input<typeof approveBillSchema>

/** Pay a lab: one amount split over its open bills; the rest stays an advance. */
export const payLabSchema = z
  .object({
    amount: rupees('Amount').refine(
      (v) => (rupeesToMinor(v) ?? 0) > 0,
      'Enter the amount paid',
    ),
    method: z.enum(['cash', 'bank_transfer', 'cheque', 'other']),
    reference: text(100),
    paidOn: z.string(),
    allocations: z.array(
      z.object({
        billId: z.string(),
        billNo: z.string(),
        balanceMinor: z.number(),
        amount: z.string().trim(),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    const amount = rupeesToMinor(v.amount) ?? 0
    let sum = 0
    v.allocations.forEach((a, i) => {
      if (!a.amount) return
      const p = rupeesToMinor(a.amount)
      if (p === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['allocations', i, 'amount'],
          message: 'Enter an amount',
        })
        return
      }
      if (p > a.balanceMinor) {
        ctx.addIssue({
          code: 'custom',
          path: ['allocations', i, 'amount'],
          message: `More than the balance of ${a.billNo}`,
        })
      }
      sum += p
    })
    if (sum > amount) {
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'The bills add up to more than the payment',
      })
    }
  })
export type PayLabValues = z.input<typeof payLabSchema>

/**
 * Statement lines as typed or pasted from the lab's sheet, one per line:
 * `reference, amount` (optionally `, date, description`).
 */
export function parseStatementLines(raw: string): {
  lines: Array<{
    labReference?: string
    amountMinor: number
    lineDate?: string
    description?: string
  }>
  errors: string[]
} {
  const lines: Array<{
    labReference?: string
    amountMinor: number
    lineDate?: string
    description?: string
  }> = []
  const errors: string[] = []
  raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((l, i) => {
      // Pasted sheets use tabs; typed lines use commas (then "1,250" can't be one amount).
      const sep = l.includes('\t') ? '\t' : l.includes(';') ? ';' : ','
      const cells: Array<string | undefined> = l.split(sep).map((c) => c.trim())
      const [ref, amount = '', date, ...rest] = cells
      const minor = rupeesToMinor(amount.replace(/[, ]/g, ''))
      if (minor === null) {
        errors.push(`Line ${i + 1}: "${amount}" is not an amount`)
        return
      }
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push(`Line ${i + 1}: date must be YYYY-MM-DD`)
        return
      }
      lines.push({
        labReference: ref || undefined,
        amountMinor: minor,
        lineDate: date || undefined,
        description: rest.join(', ') || undefined,
      })
    })
  return { lines, errors }
}

export const statementSchema = z
  .object({
    labId: z.string().min(1, 'Choose the lab'),
    periodStart: z.string().min(1, 'Choose the first day'),
    periodEnd: z.string().min(1, 'Choose the last day'),
    statementRef: text(60),
    lines: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.periodStart && v.periodEnd && v.periodEnd < v.periodStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['periodEnd'],
        message: 'Ends before it starts',
      })
    }
    const parsed = parseStatementLines(v.lines)
    if (parsed.errors.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: parsed.errors[0],
      })
    } else if (!parsed.lines.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'Add the statement’s lines',
      })
    }
  })
export type StatementValues = z.input<typeof statementSchema>

/** Edit a draft bill's header. */
export const editBillSchema = z.object({
  vendorInvoiceNo: text(60),
  billDate: z.string().min(1, 'Choose the bill date'),
  dueOn: z.string(),
  taxPercent: z
    .string()
    .trim()
    .refine((v) => percentToBp(v) !== null, 'Tax: 0–100 %'),
  notes: text(2000),
})
export type EditBillValues = z.input<typeof editBillSchema>

/** A hand-entered cost on a draft (e.g. the lab's partial charge on a cancel). */
export const billLineSchema = z.object({
  kind: z.enum(['service', 'rush', 'shipping', 'material', 'remake', 'other']),
  description: z
    .string()
    .trim()
    .min(1, 'Describe the cost')
    .max(300, 'At most 300 characters'),
  quantity: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Quantity: a whole number')
    .refine((v) => Number(v) >= 1 && Number(v) <= 10_000, 'Quantity: 1–10000'),
  unitCost: rupees('Unit cost'),
})
export type BillLineValues = z.input<typeof billLineSchema>

/** Use a payment's unallocated rest (an advance) on the lab's open bills. */
export const allocateSchema = z
  .object({
    freeMinor: z.number(),
    allocations: z.array(
      z.object({
        billId: z.string(),
        billNo: z.string(),
        balanceMinor: z.number(),
        amount: z.string().trim(),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    let sum = 0
    v.allocations.forEach((a, i) => {
      if (!a.amount) return
      const p = rupeesToMinor(a.amount)
      if (p === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['allocations', i, 'amount'],
          message: 'Enter an amount',
        })
        return
      }
      if (p > a.balanceMinor) {
        ctx.addIssue({
          code: 'custom',
          path: ['allocations', i, 'amount'],
          message: `More than the balance of ${a.billNo}`,
        })
      }
      sum += p
    })
    if (sum === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['allocations'],
        message: 'Enter an amount on at least one bill',
      })
    } else if (sum > v.freeMinor) {
      ctx.addIssue({
        code: 'custom',
        path: ['allocations'],
        message: 'More than what is left on the payment',
      })
    }
  })
export type AllocateValues = z.input<typeof allocateSchema>
