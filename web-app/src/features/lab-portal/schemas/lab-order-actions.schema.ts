import { z } from 'zod'
import { moneyField } from '@/lib/zod-numbers'

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `At most ${max} characters`)

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick the date the work will be ready')

/** One form serves every lab answer; each action checks only its fields. */
const fields = {
  labExpectedOn: z.string(),
  note: z.string(),
  reason: z.string(),
  body: z.string(),
}

/** Lab accept (lab ERD §10): the expected date is required. */
export const acceptOrderSchema = z.object({
  ...fields,
  labExpectedOn: ymd,
  note: z.string().trim().max(1000, 'At most 1000 characters'),
})

export const rejectOrderSchema = z.object({
  ...fields,
  reason: text('A reason', 1000),
})

export const clarifyOrderSchema = z.object({
  ...fields,
  body: text('Your question', 4000),
})

export const expectedDateSchema = z.object({
  ...fields,
  labExpectedOn: ymd,
  reason: text('A reason', 1000),
})

export type LabOrderActionValues = z.input<typeof acceptOrderSchema>

/** A lab admin asks the clinic to approve an extra charge on an order. */
export const chargeRequestSchema = z.object({
  kind: z.enum(['rush', 'material', 'shipping', 'other']),
  amount: moneyField('Amount', { min: 0.01 }),
  reason: text('Reason', 1000),
  itemId: z.string(),
})
export type ChargeRequestValues = z.input<typeof chargeRequestSchema>
