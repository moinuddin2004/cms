import { z } from 'zod'
import { intField, moneyField } from '@/lib/zod-numbers'

/** '' = no discount. */
export const discountKindField = z.enum(['', 'PERCENTAGE', 'FIXED'])

/**
 * Discount fields shared by plans and templates: a kind and a value; a
 * percentage stays within 100.
 */
export function refineDiscount(
  v: { discountKind: string; discountValue: string },
  ctx: z.RefinementCtx,
) {
  if (v.discountKind === 'PERCENTAGE' && Number(v.discountValue) > 100) {
    ctx.addIssue({
      code: 'custom',
      path: ['discountValue'],
      message: 'A percentage cannot be more than 100',
    })
  }
}

/** One service row: the service is required, the rest optional. */
export const planLineSchema = z.object({
  id: z.string(),
  serviceId: z.string().min(1, 'Choose a service'),
  toothNumber: z.string().trim().max(10, 'At most 10 characters'),
  estimatedSessions: intField('Sessions', { min: 1, max: 60 }),
})

/** Create / edit a patient's treatment plan. */
export const treatmentPlanSchema = z
  .object({
    planTemplateId: z.string(),
    planName: z.string().trim().max(200, 'At most 200 characters'),
    notes: z.string().max(2000, 'At most 2000 characters'),
    items: z
      .array(planLineSchema)
      .min(1, 'Add at least one service')
      .max(50, 'At most 50 services'),
    discountKind: discountKindField,
    discountValue: moneyField('Discount', { required: false }),
  })
  .superRefine(refineDiscount)

export type TreatmentPlanFormValues = z.input<typeof treatmentPlanSchema>
export type PlanLineValues = TreatmentPlanFormValues['items'][number]
