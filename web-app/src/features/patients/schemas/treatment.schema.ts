import { z } from 'zod'

/**
 * Zod schema for the "add treatment" form. A treatment always needs a name and
 * a date; cost is optional, non-negative, at most 2 decimals (kept as the
 * input's string and converted on submit); plan and encounter links are
 * optional ('' = none).
 */
export const treatmentSchema = z.object({
  planTemplateId: z.string(),
  treatmentName: z
    .string()
    .trim()
    .min(1, 'Treatment name is required')
    .max(200, 'At most 200 characters'),
  notes: z.string(),
  cost: z.string().superRefine((v, ctx) => {
    const s = v.trim()
    if (!s) return
    if (s.startsWith('-') && Number.isFinite(Number(s))) {
      ctx.addIssue({ code: 'custom', message: 'Cost cannot be negative' })
    } else if (!/^\d*\.?\d+$/.test(s)) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid amount' })
    } else if (!/^\d*(\.\d{1,2})?$/.test(s)) {
      ctx.addIssue({ code: 'custom', message: 'At most 2 decimal places' })
    }
  }),
  date: z.string().min(1, 'Date is required'),
  encounterId: z.string(),
})

export type TreatmentFormValues = z.input<typeof treatmentSchema>
