import { z } from 'zod'
import { moneyField } from '@/lib/zod-numbers'

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
  cost: moneyField('Cost', { required: false }),
  date: z.string().min(1, 'Date is required'),
  encounterId: z.string(),
})

export type TreatmentFormValues = z.input<typeof treatmentSchema>
