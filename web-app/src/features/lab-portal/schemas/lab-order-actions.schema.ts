import { z } from 'zod'

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
