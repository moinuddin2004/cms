import { z } from 'zod'

/**
 * Zod schema for the "add treatment" form. A treatment always needs a name and
 * a date; cost is optional and non-negative; an encounter link is optional
 * (standalone treatments leave it empty).
 */
export const treatmentSchema = z.object({
  treatmentName: z.string().trim().min(1, 'Treatment name is required'),
  notes: z.string().optional(),
  cost: z.number().min(0, 'Cost cannot be negative').optional(),
  date: z.string().min(1, 'Date is required'),
  encounterId: z.string().optional(),
})

export type TreatmentSchema = z.infer<typeof treatmentSchema>
