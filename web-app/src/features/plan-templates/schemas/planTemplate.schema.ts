import { z } from 'zod'
import { PlanTemplateCategory } from '../types'

const max = (n: number) => z.string().max(n, `At most ${n} characters`)

/** One procedure row. Blank rows are allowed and dropped on save. */
const itemSchema = z.object({
  procedureName: max(200),
  estimatedSessions: z
    .number()
    .int('Whole sessions only')
    .min(1, 'At least 1 session'),
  /** '' = not set. */
  estimatedCost: z
    .string()
    .trim()
    .refine(
      (v) => !v || (Number.isFinite(Number(v)) && Number(v) >= 0),
      'Enter a valid fee',
    ),
})

/** Create / edit a treatment plan template. */
export const planTemplateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(200, 'At most 200 characters'),
    category: z.enum(PlanTemplateCategory),
    description: max(1000),
    items: z.array(itemSchema),
  })
  .superRefine((v, ctx) => {
    const named = v.items.filter((i) => i.procedureName.trim()).length
    if (named === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Add at least one procedure',
      })
    } else if (named > 50) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'At most 50 procedures',
      })
    }
  })

export type PlanTemplateFormValues = z.input<typeof planTemplateSchema>
export type PlanTemplateItemValues = PlanTemplateFormValues['items'][number]
